import { afterEach, beforeEach, describe, expect, rs, test } from "@rstest/core";
import "./index";

type HttpMockHandler = (options: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  data?: unknown;
  body?: unknown;
}) => unknown | Promise<unknown>;

function makeSongRow(videoId: string, title: string, artistId: string, artistName: string, duration = "3:30") {
  return {
    musicResponsiveListItemRenderer: {
      playlistItemData: { videoId },
      thumbnail: { thumbnails: [{ url: `https://lh3.googleusercontent.com/${videoId}=w120-h120-l90-rj` }] },
      flexColumns: [
        {
          musicResponsiveListItemFlexColumnRenderer: {
            text: { runs: [{ text: title, navigationEndpoint: { watchEndpoint: { videoId } } }] },
          },
        },
        {
          musicResponsiveListItemFlexColumnRenderer: {
            text: {
              runs: [
                {
                  text: artistName,
                  navigationEndpoint: {
                    browseEndpoint: {
                      browseId: artistId,
                      browseEndpointContextSupportedConfigs: {
                        browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ARTIST" },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      ],
      fixedColumns: duration
        ? [{ musicResponsiveListItemFixedColumnRenderer: { text: { runs: [{ text: duration }] } } }]
        : [],
    },
  };
}

function makeAlbumCard(browseId: string, title: string, artistId: string, artistName: string, year = "2024") {
  return {
    musicTwoRowItemRenderer: {
      title: { runs: [{ text: title }] },
      subtitle: {
        runs: [
          { text: "Album" },
          { text: " • " },
          {
            text: artistName,
            navigationEndpoint: {
              browseEndpoint: {
                browseId: artistId,
                browseEndpointContextSupportedConfigs: {
                  browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ARTIST" },
                },
              },
            },
          },
          { text: " • " },
          { text: year },
        ],
      },
      thumbnailRenderer: { thumbnails: [{ url: `https://lh3.googleusercontent.com/${browseId}=w226-h226-l90-rj` }] },
      navigationEndpoint: {
        browseEndpoint: {
          browseId,
          browseEndpointContextSupportedConfigs: {
            browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ALBUM" },
          },
        },
      },
    },
  };
}

function makePlaylistCard(playlistId: string, title: string, owner = "YouTube Music") {
  return {
    musicTwoRowItemRenderer: {
      title: { runs: [{ text: title }] },
      subtitle: { runs: [{ text: "Playlist" }, { text: " • " }, { text: owner }] },
      thumbnailRenderer: { thumbnails: [{ url: `https://lh3.googleusercontent.com/${playlistId}=w226-h226-l90-rj` }] },
      navigationEndpoint: {
        browseEndpoint: {
          browseId: `VL${playlistId}`,
          browseEndpointContextSupportedConfigs: {
            browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_PLAYLIST" },
          },
        },
      },
    },
  };
}

function makeArtistRow(artistId: string, name: string, subscribers = "1M subscribers") {
  return {
    musicResponsiveListItemRenderer: {
      thumbnail: { thumbnails: [{ url: `https://lh3.googleusercontent.com/${artistId}=w120-h120-l90-rj` }] },
      flexColumns: [
        { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: name }] } } },
        { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: subscribers }] } } },
      ],
      navigationEndpoint: {
        browseEndpoint: {
          browseId: artistId,
          browseEndpointContextSupportedConfigs: {
            browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ARTIST" },
          },
        },
      },
    },
  };
}

function mockWidgetHttp(handler: HttpMockHandler) {
  return rs.spyOn(Widget.http, "request").mockImplementation(async (options) => {
    expect(options.body).toBeUndefined();
    const data = await handler(options);
    return {
      data,
      statusCode: 200,
      headers: {},
    };
  });
}

describe("Rex YouTube Music widget", () => {
  beforeEach(() => {
    Widget.storage.clear();
  });

  afterEach(() => {
    rs.restoreAllMocks();
    Widget.storage.clear();
  });

  test("registers Rex 0.0.7 music metadata and all entrypoints", () => {
    expect(WidgetMetadata.id).toBe("baranwang.music.youtube");
    expect(WidgetMetadata.contentType).toBe("music");
    expect(WidgetMetadata.requiredVersion).toBe("0.0.7");
    expect(WidgetMetadata.continuousPlay).toBe(true);
    expect(WidgetMetadata.modules.map((m) => m.id)).toEqual([
      "home",
      "charts",
      "newReleases",
      "musicGenres",
      "musicRadios",
      "musicArtists",
      "library",
    ]);
    expect(WidgetMetadata.search?.functionName).toBe("search");
    expect(typeof loadHome).toBe("function");
    expect(typeof loadCharts).toBe("function");
    expect(typeof loadNewReleases).toBe("function");
    expect(typeof loadGenres).toBe("function");
    expect(typeof loadRadios).toBe("function");
    expect(typeof loadArtists).toBe("function");
    expect(typeof loadLibrary).toBe("function");
    expect(typeof search).toBe("function");
    expect(typeof loadDetail).toBe("function");
  });

  test("loadHome loads page 1 and paginates page 2 via stored continuation token", async () => {
    mockWidgetHttp((options) => {
      const body = options.data as Record<string, unknown>;
      if (body.browseId === "FEmusic_home") {
        return {
          contents: {
            sectionListRenderer: {
              contents: [
                {
                  musicCarouselShelfRenderer: {
                    header: { musicCarouselShelfBasicHeaderRenderer: { title: { runs: [{ text: "Quick picks" }] } } },
                    contents: Array.from({ length: 8 }, (_, idx) =>
                      makeSongRow(`song_p1_${idx}`, `Song P1 #${idx}`, "UC_a1", "Artist A"),
                    ),
                  },
                },
              ],
              continuations: [{ nextContinuationData: { continuation: "home_tok_2" } }],
            },
          },
        };
      }
      if (body.continuation === "home_tok_2") {
        return {
          continuationContents: {
            sectionListContinuation: {
              contents: [
                {
                  musicCarouselShelfRenderer: {
                    header: { musicCarouselShelfBasicHeaderRenderer: { title: { runs: [{ text: "More picks" }] } } },
                    contents: [makeAlbumCard("MPREb_p2", "Page 2 Album", "UC_a2", "Artist B")],
                  },
                },
              ],
            },
          },
        };
      }
      throw new Error(`Unexpected request: ${JSON.stringify(body)}`);
    });

    const page1 = await loadHome({ filter: "all", page: "1" } as LoadHomeParams);
    expect(page1).toHaveLength(8);
    expect(page1[0]).toMatchObject({
      id: "song_p1_0",
      mediaType: "song",
      link: "ytm:song:song_p1_0",
      duration: 210,
      durationText: "3:30",
    });

    const page2 = await loadHome({ filter: "all", page: "2" } as LoadHomeParams);
    expect(page2).toHaveLength(1);
    expect(page2[0]).toMatchObject({
      id: "MPREb_p2",
      mediaType: "album",
      link: "ytm:album:MPREb_p2",
    });

    const page3 = await loadHome({ filter: "all", page: "3" } as LoadHomeParams);
    expect(page3).toEqual([]);
  });

  test("loadGenres returns genre directory and supports albums/songs/artists sections", async () => {
    mockWidgetHttp((options) => {
      const body = options.data as Record<string, unknown>;
      if (body.browseId === "FEmusic_moods_and_genres") {
        return {
          contents: [
            {
              musicNavigationButtonRenderer: {
                buttonText: { runs: [{ text: "J-Pop" }] },
                clickCommand: {
                  browseEndpoint: { browseId: "FEmusic_moods_and_genres_category", params: "genre_jpop" },
                },
              },
            },
          ],
        };
      }
      if (body.browseId === "FEmusic_moods_and_genres_category" && body.params === "genre_jpop") {
        return {
          sectionListRenderer: {
            contents: [
              {
                musicCarouselShelfRenderer: {
                  contents: [
                    makeAlbumCard("MPREb_jp1", "JP Album", "UC_jp", "JP Artist"),
                    makeSongRow("jp_song_1", "JP Song", "UC_jp", "JP Artist"),
                    makeArtistRow("UC_jp", "JP Artist"),
                  ],
                },
              },
            ],
          },
        };
      }
      throw new Error(`Unexpected request: ${JSON.stringify(body)}`);
    });

    const dir = await loadGenres({} as LoadGenresParams);
    expect(dir).toEqual([
      { id: "genre_jpop", type: "url", mediaType: "genre", link: "ytm:genre:genre_jpop", title: "J-Pop" },
    ]);

    const albums = await loadGenres({ genreId: "ytm:genre:genre_jpop", section: "albums" } as LoadGenresParams);
    expect(albums[0]?.mediaType).toBe("album");

    const songs = await loadGenres({ genreId: "ytm:genre:genre_jpop", section: "songs" } as LoadGenresParams);
    expect(songs[0]?.mediaType).toBe("song");

    const artists = await loadGenres({ genreId: "ytm:genre:genre_jpop", section: "artists" } as LoadGenresParams);
    expect(artists[0]?.type).toBe("person");
  });

  test("loadArtists supports directory, profile, songs, albums, and similar artists", async () => {
    mockWidgetHttp((options) => {
      const body = options.data as Record<string, unknown>;
      if (body.browseId === "FEmusic_charts") {
        return {
          sectionListRenderer: {
            contents: [
              {
                musicCarouselShelfRenderer: {
                  contents: [makeArtistRow("UC_yoasobi", "YOASOBI", "7.5M subscribers")],
                },
              },
            ],
          },
        };
      }
      if (body.browseId === "UC_yoasobi") {
        return {
          header: {
            musicImmersiveHeaderRenderer: {
              title: { runs: [{ text: "YOASOBI" }] },
              description: { runs: [{ text: "Japanese music duo." }] },
              thumbnail: { thumbnails: [{ url: "https://lh3.googleusercontent.com/yoa=w120-h120-l90-rj" }] },
            },
          },
          sectionListRenderer: {
            contents: [
              {
                musicShelfRenderer: {
                  contents: [makeSongRow("vid_idol", "Idol", "UC_yoasobi", "YOASOBI", "3:46")],
                },
              },
              {
                musicCarouselShelfRenderer: {
                  contents: [
                    makeAlbumCard("MPREb_book", "THE BOOK", "UC_yoasobi", "YOASOBI"),
                    makeArtistRow("UC_similar", "Yorushika"),
                  ],
                },
              },
            ],
          },
        };
      }
      throw new Error(`Unexpected request: ${JSON.stringify(body)}`);
    });

    const directory = await loadArtists({} as LoadArtistsParams);
    expect(directory[0]).toMatchObject({ id: "UC_yoasobi", type: "person", title: "YOASOBI" });

    const profile = await loadArtists({ peopleId: "UC_yoasobi", section: "profile" } as LoadArtistsParams);
    expect(profile).toHaveLength(1);
    expect(profile[0]).toMatchObject({
      id: "UC_yoasobi",
      type: "person",
      title: "YOASOBI",
      description: "Japanese music duo.",
    });

    const songs = await loadArtists({ peopleId: "UC_yoasobi", section: "songs" } as LoadArtistsParams);
    expect(songs[0]?.id).toBe("vid_idol");

    const albums = await loadArtists({ peopleId: "UC_yoasobi", section: "albums" } as LoadArtistsParams);
    expect(albums[0]?.id).toBe("MPREb_book");

    const similar = await loadArtists({ peopleId: "UC_yoasobi", section: "artists" } as LoadArtistsParams);
    expect(similar[0]?.id).toBe("UC_similar");
  });

  test("loadLibrary requires cookie, sends SAPISIDHASH, filters LM/SE playlists, and handles 401", async () => {
    await expect(loadLibrary({ tab: "liked", page: "1", cookie: "" } as LoadLibraryParams)).rejects.toThrow(/Cookie/);

    const seenAuthHeaders: Array<string | undefined> = [];
    mockWidgetHttp((options) => {
      seenAuthHeaders.push(options.headers?.authorization);
      const body = options.data as Record<string, unknown>;
      if (body.browseId === "FEmusic_liked_playlists") {
        return {
          sectionListRenderer: {
            contents: [
              {
                gridRenderer: {
                  items: [
                    makePlaylistCard("LM", "Liked Music"),
                    makePlaylistCard("SE", "Episodes for Later"),
                    makePlaylistCard("PL_my_fav", "My Favorites", "Me"),
                  ],
                },
              },
            ],
          },
        };
      }
      if (body.browseId === "VLLM") {
        throw new Error("HTTP 401: unauthorized");
      }
      return {};
    });

    const playlists = await loadLibrary({
      tab: "playlists",
      page: "1",
      cookie: "SAPISID=test_sid_value",
    } as LoadLibraryParams);
    expect(seenAuthHeaders[0]).toMatch(/^SAPISIDHASH \d+_[0-9a-f]{40}$/);
    expect(playlists).toHaveLength(1);
    expect(playlists[0]?.id).toBe("PL_my_fav");

    await expect(
      loadLibrary({ tab: "liked", page: "1", cookie: "SAPISID=expired_sid" } as LoadLibraryParams),
    ).rejects.toThrow(/失效|expired/);
  });

  test("search supports mixed all pagination across pages 2+ and filtered search with continuation", async () => {
    mockWidgetHttp((options) => {
      const body = options.data as Record<string, unknown>;
      if (options.url.includes("/search") && !body.params && !body.continuation) {
        return {
          sectionListRenderer: {
            contents: [
              {
                musicCardShelfRenderer: {
                  title: {
                    runs: [
                      {
                        text: "YOASOBI",
                        navigationEndpoint: {
                          browseEndpoint: {
                            browseId: "UC_yoasobi",
                            browseEndpointContextSupportedConfigs: {
                              browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ARTIST" },
                            },
                          },
                        },
                      },
                    ],
                  },
                  subtitle: { runs: [{ text: "Artist" }] },
                },
              },
              {
                musicShelfRenderer: {
                  contents: [makeSongRow("vid_1", "Idol", "UC_yoasobi", "YOASOBI", "3:46")],
                },
              },
            ],
          },
        };
      }
      if (options.url.includes("/search") && body.params) {
        return {
          musicShelfRenderer: {
            contents: [
              makeSongRow("vid_1", "Idol", "UC_yoasobi", "YOASOBI", "3:46"),
              makeSongRow("vid_s1", "Filtered Song 1", "UC_yoasobi", "YOASOBI", "3:00"),
            ],
            continuations: [{ nextContinuationData: { continuation: "search_tok_2" } }],
          },
        };
      }
      if (options.url.includes("/search") && body.continuation === "search_tok_2") {
        return {
          musicShelfContinuation: {
            contents: [makeSongRow("vid_s2", "Filtered Song 2", "UC_yoasobi", "YOASOBI", "4:00")],
          },
        };
      }
      return {};
    });

    const mixedP1 = await search({ keyword: "YOASOBI", kind: "all", page: "1" } as SearchParams);
    expect(mixedP1.map((item) => item.mediaType)).toEqual(["person", "song"]);

    // Page 2 continues into songs search and skips vid_1 already returned on page 1
    const mixedP2 = await search({ keyword: "YOASOBI", kind: "all", page: "2" } as SearchParams);
    expect(mixedP2.map((item) => item.id)).toEqual(["vid_s1"]);

    // Page 3 follows the continuation token stored by page 2, and page 4 ends cleanly
    const mixedP3 = await search({ keyword: "YOASOBI", kind: "all", page: "3" } as SearchParams);
    expect(mixedP3.map((item) => item.id)).toEqual(["vid_s2"]);

    const mixedP4 = await search({ keyword: "YOASOBI", kind: "all", page: "4" } as SearchParams);
    expect(mixedP4).toEqual([]);

    const songsP1 = await search({ keyword: "YOASOBI", kind: "songs", page: "1" } as SearchParams);
    const songsP2 = await search({ keyword: "YOASOBI", kind: "songs", page: "2" } as SearchParams);
    expect(songsP1.map((item) => item.id)).toEqual(["vid_1", "vid_s1"]);
    expect(songsP2.map((item) => item.id)).toEqual(["vid_s2"]);
  });

  test("loadDetail resolves song via VISIONOS, falls back to IOS, caches stream, and dispatches history reporting off the critical path", async () => {
    const futureExpire = Math.floor(Date.now() / 1000) + 7200;
    let playerCalls = 0;
    const requestedUrls: string[] = [];
    let releaseHistoryReport: (() => void) | undefined;
    const historyGate = new Promise<void>((resolve) => {
      releaseHistoryReport = resolve;
    });

    mockWidgetHttp(async (options) => {
      requestedUrls.push(options.url);
      if (options.url.includes("/visitor_id")) {
        return { responseContext: { visitorData: "VISITOR_123" } };
      }
      if (options.url.includes("/player")) {
        const body = options.data as {
          context: { client: { clientName: string } };
          playbackContext?: unknown;
        };
        if (body.playbackContext) {
          await historyGate;
          return {
            playbackTracking: {
              videostatsPlaybackUrl: { baseUrl: "https://s.youtube.com/api/stats/playback?ei=abc" },
            },
          };
        }
        playerCalls++;
        if (body.context.client.clientName === "VISIONOS" && playerCalls === 1) {
          return { playabilityStatus: { status: "LOGIN_REQUIRED", reason: "temporary challenge" } };
        }
        return {
          playabilityStatus: { status: "OK" },
          videoDetails: {
            videoId: "vid_test_01",
            title: "Test Track",
            author: "Test Artist - Topic",
            channelId: "UC_test",
            lengthSeconds: "226",
            thumbnail: { thumbnails: [{ url: "https://lh3.googleusercontent.com/t=w120-h120-l90-rj" }] },
          },
          streamingData: {
            adaptiveFormats: [
              {
                itag: 140,
                mimeType: 'audio/mp4; codecs="mp4a.40.2"',
                bitrate: 130000,
                url: `https://rr1.googlevideo.com/videoplayback?itag=140&expire=${futureExpire}`,
              },
              {
                itag: 251,
                mimeType: 'audio/webm; codecs="opus"',
                bitrate: 150000,
                url: `https://rr1.googlevideo.com/videoplayback?itag=251&expire=${futureExpire}`,
              },
              {
                itag: 252,
                mimeType: 'audio/webm; codecs="opus"',
                bitrate: 256000,
                isDrc: true,
                url: `https://rr1.googlevideo.com/videoplayback?itag=252&expire=${futureExpire}`,
              },
            ],
          },
        };
      }
      if (options.url.startsWith("https://s.youtube.com/api/stats/playback")) {
        return "";
      }
      throw new Error(`Unexpected url: ${options.url}`);
    });

    // Save runtime config via a module call (simulating Rex globalParams persistence)
    await Promise.resolve(
      loadCharts({
        category: "all",
        page: "1",
        audioFormat: "opus",
        playerType: "auto",
        reportHistory: "true",
        cookie: "SAPISID=hist_sid",
      } as LoadChartsParams),
    ).catch(() => {});

    // loadDetail must resolve immediately even while history reporting is still pending on historyGate
    const detail = (await loadDetail("ytm:song:vid_test_01")) as VideoItem;
    expect(detail.id).toBe("vid_test_01");
    expect(detail.mediaType).toBe("song");
    expect(detail.videoUrl).toContain("itag=251");
    expect(detail.playerType).toBe("app");
    expect(detail.duration).toBe(226);
    expect(detail.durationText).toBe("3:46");
    expect(detail.subtitle).toBe("Test Artist");
    expect(requestedUrls.some((u) => u.startsWith("https://s.youtube.com/api/stats/playback"))).toBe(false);

    // Release history reporting and verify the tracking ping completes in the background
    releaseHistoryReport?.();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(requestedUrls.some((u) => u.startsWith("https://s.youtube.com/api/stats/playback"))).toBe(true);

    // Second call hits 1-hour stream cache without re-invoking player for stream resolution
    const callsBefore = playerCalls;
    const cachedDetail = (await loadDetail("ytm:song:vid_test_01")) as VideoItem;
    expect(cachedDetail.videoUrl).toBe(detail.videoUrl);
    expect(playerCalls).toBe(callsBefore);
  });

  test("loadDetail resolves album with tracks, duration enrichment, relatedItems, and playlist with continuation", async () => {
    mockWidgetHttp((options) => {
      const body = options.data as Record<string, unknown>;
      if (body.browseId === "MPREb_album1") {
        return {
          header: {
            musicResponsiveHeaderRenderer: {
              title: { runs: [{ text: "THE BOOK" }] },
              straplineTextOne: {
                runs: [
                  {
                    text: "YOASOBI",
                    navigationEndpoint: {
                      browseEndpoint: {
                        browseId: "UC_yoasobi",
                        browseEndpointContextSupportedConfigs: {
                          browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ARTIST" },
                        },
                      },
                    },
                  },
                ],
              },
              subtitle: { runs: [{ text: "EP • 2021" }] },
              thumbnail: { thumbnails: [{ url: "https://lh3.googleusercontent.com/book=w226-h226-l90-rj" }] },
            },
          },
          sectionListRenderer: {
            contents: [
              {
                musicShelfRenderer: {
                  contents: [makeSongRow("alb_t1", "Epilogue", "", "", "")],
                },
              },
              {
                musicCarouselShelfRenderer: {
                  contents: [makeAlbumCard("MPREb_album2", "THE BOOK 2", "UC_yoasobi", "YOASOBI", "2021")],
                },
              },
            ],
          },
        };
      }
      if (options.url.includes("/music/get_queue")) {
        return {
          queueDatas: [
            {
              content: {
                playlistPanelVideoRenderer: {
                  videoId: "alb_t1",
                  lengthText: { runs: [{ text: "0:50" }] },
                },
              },
            },
          ],
        };
      }
      if (body.browseId === "VLPL_multi") {
        return {
          header: {
            musicResponsiveHeaderRenderer: {
              title: { runs: [{ text: "Long Playlist" }] },
              straplineTextOne: { runs: [{ text: "Curator" }] },
            },
          },
          musicPlaylistShelfRenderer: {
            contents: [makeSongRow("pl_t1", "Song 1", "UC_1", "Artist 1", "3:00")],
            continuations: [{ nextContinuationData: { continuation: "pl_tok_2" } }],
          },
        };
      }
      if (body.continuation === "pl_tok_2") {
        return {
          musicPlaylistShelfContinuation: {
            contents: [makeSongRow("pl_t2", "Song 2", "UC_2", "Artist 2", "4:00")],
          },
        };
      }
      throw new Error(`Unexpected request: ${JSON.stringify(body)}`);
    });

    const album = (await loadDetail("ytm:album:MPREb_album1")) as VideoItem;
    expect(album.mediaType).toBe("album");
    expect(album.releaseDate).toBe("2021");
    expect(album.tracks).toHaveLength(1);
    expect(album.tracks?.[0]).toMatchObject({
      id: "alb_t1",
      duration: 50,
      durationText: "0:50",
      subtitle: "YOASOBI",
    });
    expect(album.relatedItems?.[0]?.id).toBe("MPREb_album2");

    const playlist = (await loadDetail("ytm:playlist:PL_multi")) as VideoItem;
    expect(playlist.mediaType).toBe("playlist");
    expect(playlist.tracks?.map((t) => t.id)).toEqual(["pl_t1", "pl_t2"]);

    await expect(loadDetail("unknown:123")).rejects.toThrow();
  });

  test("loadRadios seeds Personal Radio from lastPlayed track", async () => {
    const futureExpire = Math.floor(Date.now() / 1000) + 7200;
    mockWidgetHttp((options) => {
      if (options.url.includes("/visitor_id")) {
        return { responseContext: { visitorData: "VIS_RADIO" } };
      }
      if (options.url.includes("/player")) {
        return {
          playabilityStatus: { status: "OK" },
          videoDetails: { videoId: "seed_track", title: "Seed Song", lengthSeconds: "200" },
          streamingData: {
            adaptiveFormats: [
              {
                itag: 140,
                mimeType: 'audio/mp4; codecs="mp4a.40.2"',
                bitrate: 130000,
                url: `https://rr1.googlevideo.com/videoplayback?itag=140&expire=${futureExpire}`,
              },
            ],
          },
        };
      }
      if (options.url.includes("/next")) {
        const body = options.data as { videoId?: string; playlistId?: string };
        expect(body.videoId).toBe("seed_track");
        expect(body.playlistId).toBe("RDAMVMseed_track");
        return {
          contents: [
            {
              playlistPanelVideoRenderer: {
                videoId: "seed_track",
                title: { runs: [{ text: "Seed Song" }] },
                lengthText: { runs: [{ text: "3:20" }] },
              },
            },
            {
              playlistPanelVideoRenderer: {
                videoId: "radio_next_1",
                title: { runs: [{ text: "Next Recommended Song" }] },
                lengthText: { runs: [{ text: "3:45" }] },
                longBylineText: { runs: [{ text: "Similar Artist" }] },
              },
            },
          ],
        };
      }
      throw new Error(`Unexpected request: ${options.url}`);
    });

    await loadDetail("ytm:song:seed_track");
    const queue = await loadRadios({ radioId: "ytm:radio:personal", section: "songs" } as LoadRadiosParams);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      id: "radio_next_1",
      mediaType: "song",
      title: "Next Recommended Song",
      duration: 225,
    });
  });
});
