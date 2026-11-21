import { describe, expect, test } from "@rstest/core";
import {
  cardOf,
  cardShelfOf,
  extractGenreButtons,
  formatDuration,
  imageOf,
  panelTrackOf,
  rowOf,
  rowsOf,
  secondsOf,
  sectionsOf,
  toRexAlbum,
  toRexArtist,
  toRexPlaylist,
  toRexSong,
} from "./parser";

describe("parser primitives", () => {
  test("parses and formats track durations in seconds", () => {
    expect(secondsOf("3:46")).toBe(226);
    expect(secondsOf("1:02:05")).toBe(3725);
    expect(secondsOf("invalid")).toBe(0);

    expect(formatDuration(226)).toBe("3:46");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(0)).toBe("");
  });

  test("upscales Googleusercontent thumbnails and keeps ytimg thumbnails intact", () => {
    const lh3 = imageOf({
      thumbnails: [{ url: "https://lh3.googleusercontent.com/abc=w60-h60-l90-rj" }],
    });
    expect(lh3).toBe("https://lh3.googleusercontent.com/abc=w544-h544-l90-rj");

    const ytimg = imageOf({
      thumbnails: [{ url: "https://i.ytimg.com/vi/ZRtdQ81jPUQ/hq720.jpg?sqp=123" }],
    });
    expect(ytimg).toBe("https://i.ytimg.com/vi/ZRtdQ81jPUQ/hq720.jpg?sqp=123");
  });
});

describe("YouTube Music node parsers and Rex mappers", () => {
  test("parses song row with artist credits, album, duration, and maps to Rex song", () => {
    const parsed = rowOf({
      playlistItemData: { videoId: "vid12345678" },
      thumbnail: { thumbnails: [{ url: "https://lh3.googleusercontent.com/cover=w120-h120-l90-rj" }] },
      flexColumns: [
        {
          musicResponsiveListItemFlexColumnRenderer: {
            text: { runs: [{ text: "夜に駆ける", navigationEndpoint: { watchEndpoint: { videoId: "vid12345678" } } }] },
          },
        },
        {
          musicResponsiveListItemFlexColumnRenderer: {
            text: {
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
                { text: " • " },
                {
                  text: "THE BOOK",
                  navigationEndpoint: {
                    browseEndpoint: {
                      browseId: "MPREb_book",
                      browseEndpointContextSupportedConfigs: {
                        browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ALBUM" },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      ],
      fixedColumns: [
        {
          musicResponsiveListItemFixedColumnRenderer: {
            text: { runs: [{ text: "4:21" }] },
          },
        },
      ],
    });

    expect(parsed?.kind).toBe("track");
    if (parsed?.kind !== "track") return;

    const song = toRexSong(parsed.value);
    expect(song).toEqual({
      id: "vid12345678",
      type: "url",
      mediaType: "song",
      link: "ytm:song:vid12345678",
      title: "夜に駆ける",
      subtitle: "YOASOBI",
      posterPath: "https://lh3.googleusercontent.com/cover=w544-h544-l90-rj",
      coverUrl: "https://lh3.googleusercontent.com/cover=w544-h544-l90-rj",
      duration: 261,
      durationText: "4:21",
      peoples: [{ id: "UC_yoasobi", title: "YOASOBI", role: "歌手" }],
    });
  });

  test("omits unlinked artist names from peoples while preserving them in subtitle", () => {
    const song = toRexSong({
      id: "abc",
      name: "Untitled Demo",
      artists: [{ id: "", name: "Indie Singer" }],
      duration: 180,
    });
    expect(song.subtitle).toBe("Indie Singer");
    expect(song.peoples).toBeUndefined();
  });

  test("skips podcast episodes and podcast show rows", () => {
    expect(
      rowOf({
        playlistItemData: { videoId: "pod12345678" },
        flexColumns: [
          {
            musicResponsiveListItemFlexColumnRenderer: {
              text: {
                runs: [
                  {
                    text: "Podcast Episode 1",
                    navigationEndpoint: {
                      watchEndpoint: {
                        videoId: "pod12345678",
                        watchEndpointMusicSupportedConfigs: {
                          watchEndpointMusicConfig: { musicVideoType: "MUSIC_VIDEO_TYPE_PODCAST_EPISODE" },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      }),
    ).toBeNull();

    expect(
      cardOf({
        title: { runs: [{ text: "Podcast Show" }] },
        navigationEndpoint: {
          browseEndpoint: {
            browseId: "MPSP_show",
            browseEndpointContextSupportedConfigs: {
              browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_PODCAST_SHOW_DETAIL_PAGE" },
            },
          },
        },
      }),
    ).toBeNull();
  });

  test("parses album, playlist, artist cards, top-result card shelf, genres, and panel tracks", () => {
    const albumCard = cardOf({
      title: { runs: [{ text: "THE BOOK" }] },
      subtitle: {
        runs: [
          { text: "Album" },
          { text: " • " },
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
          { text: " • " },
          { text: "2021" },
        ],
      },
      thumbnailRenderer: { thumbnails: [{ url: "https://lh3.googleusercontent.com/alb=w226-h226-l90-rj" }] },
      navigationEndpoint: {
        browseEndpoint: {
          browseId: "MPREb_book",
          browseEndpointContextSupportedConfigs: {
            browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ALBUM" },
          },
        },
      },
    });
    expect(albumCard?.kind).toBe("album");
    if (albumCard?.kind === "album") {
      expect(toRexAlbum(albumCard.value)).toEqual({
        id: "MPREb_book",
        type: "url",
        mediaType: "album",
        link: "ytm:album:MPREb_book",
        title: "THE BOOK",
        subtitle: "YOASOBI",
        posterPath: "https://lh3.googleusercontent.com/alb=w544-h544-l90-rj",
        coverUrl: "https://lh3.googleusercontent.com/alb=w544-h544-l90-rj",
        releaseDate: "2021",
        peoples: [{ id: "UC_yoasobi", title: "YOASOBI", role: "歌手" }],
      });
    }

    const playlistCard = cardOf({
      title: { runs: [{ text: "J-Pop Hits" }] },
      subtitle: { runs: [{ text: "Playlist" }, { text: " • " }, { text: "YouTube Music" }] },
      navigationEndpoint: {
        browseEndpoint: {
          browseId: "VLPL_jpop",
          browseEndpointContextSupportedConfigs: {
            browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_PLAYLIST" },
          },
        },
      },
    });
    expect(playlistCard?.kind).toBe("playlist");
    if (playlistCard?.kind === "playlist") {
      expect(toRexPlaylist(playlistCard.value)).toEqual({
        id: "PL_jpop",
        type: "url",
        mediaType: "playlist",
        link: "ytm:playlist:PL_jpop",
        title: "J-Pop Hits",
        subtitle: "YouTube Music",
      });
    }

    const topResult = cardShelfOf({
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
      subtitle: { runs: [{ text: "Artist" }, { text: " • " }, { text: "7.5M subscribers" }] },
      thumbnail: { thumbnails: [{ url: "https://lh3.googleusercontent.com/art=w120-h120-l90-rj" }] },
    });
    expect(topResult[0]?.kind).toBe("artist");
    if (topResult[0]?.kind === "artist") {
      const artist = toRexArtist(topResult[0].value);
      expect(artist.type).toBe("person");
      expect(artist.link).toBeUndefined();
      expect(artist.avatar).toBe("https://lh3.googleusercontent.com/art=w544-h544-l90-rj");
    }

    const genreButtons = extractGenreButtons({
      contents: [
        {
          musicNavigationButtonRenderer: {
            buttonText: { runs: [{ text: "J-Pop" }] },
            clickCommand: {
              browseEndpoint: {
                browseId: "FEmusic_moods_and_genres_category",
                params: "ggMPOg1uX1lB",
              },
            },
          },
        },
      ],
    });
    expect(genreButtons).toEqual([
      {
        id: "ggMPOg1uX1lB",
        title: "J-Pop",
        browseId: "FEmusic_moods_and_genres_category",
        params: "ggMPOg1uX1lB",
      },
    ]);

    const panel = panelTrackOf({
      videoId: "ZRtdQ81jPUQ",
      title: { runs: [{ text: "Idol" }] },
      lengthText: { runs: [{ text: "3:46" }] },
      longBylineText: {
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
    });
    expect(panel?.duration).toBe(226);
    expect(panel?.artists[0]?.id).toBe("UC_yoasobi");
  });

  test("extracts sections and continuation tokens from initial and continuation payloads", () => {
    const initial = rowsOf({
      musicPlaylistShelfRenderer: {
        contents: [
          {
            musicResponsiveListItemRenderer: {
              playlistItemData: { videoId: "track_1" },
              flexColumns: [{ musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: "Track 1" }] } } }],
            },
          },
        ],
        continuations: [{ nextContinuationData: { continuation: "token_p2" } }],
      },
    });
    expect(initial.items).toHaveLength(1);
    expect(initial.token).toBe("token_p2");

    const nextPage = rowsOf({
      onResponseReceivedActions: [
        {
          appendContinuationItemsAction: {
            continuationItems: [
              {
                musicResponsiveListItemRenderer: {
                  playlistItemData: { videoId: "track_2" },
                  flexColumns: [
                    { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: "Track 2" }] } } },
                  ],
                },
              },
              {
                continuationItemRenderer: {
                  continuationEndpoint: { continuationCommand: { token: "token_p3" } },
                },
              },
            ],
          },
        },
      ],
    });
    expect(nextPage.items).toHaveLength(1);
    expect(nextPage.token).toBe("token_p3");

    const sections = sectionsOf({
      sectionListRenderer: {
        contents: [
          {
            itemSectionRenderer: {
              contents: [
                {
                  musicResponsiveListItemRenderer: {
                    playlistItemData: { videoId: "track_3" },
                    flexColumns: [
                      { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: "Track 3" }] } } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    });
    expect(sections[0]?.tracks[0]?.id).toBe("track_3");
  });
});
