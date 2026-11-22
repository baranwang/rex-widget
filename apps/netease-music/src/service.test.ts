import { afterEach, beforeEach, describe, expect, rs, test } from "@rstest/core";
import {
  handleArtists,
  handleCharts,
  handleDetail,
  handleGenres,
  handleHome,
  handleLibrary,
  handleNewReleases,
  handleRadios,
  handleSearch,
} from "./service";

type MockResponse = {
  data: unknown;
  statusCode?: number;
  headers?: Record<string, string>;
};

type RequestHandler = (opts: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  data?: unknown;
}) => MockResponse | Promise<MockResponse>;

function stubHttp(handler: RequestHandler) {
  return rs.spyOn(Widget.http, "request").mockImplementation(async (opts) => {
    const res = await handler(opts);
    return {
      data: res.data,
      statusCode: res.statusCode ?? 200,
      headers: res.headers ?? {},
    } as never;
  });
}

describe("netease-music service", () => {
  beforeEach(() => {
    Widget.storage.clear();
  });

  afterEach(() => {
    rs.restoreAllMocks();
  });

  test("handleHome works anonymously with recommended playlists and new songs", async () => {
    stubHttp((opts) => {
      if (opts.url.includes("/api/personalized/playlist")) {
        return {
          data: {
            code: 200,
            result: [{ id: 1001, name: "深夜民谣", picUrl: "http://p1.music.126.net/p1.jpg", copywriter: "编辑推荐" }],
          },
        };
      }
      if (opts.url.includes("/api/personalized/newsong")) {
        return {
          data: {
            code: 200,
            result: [
              {
                id: 2001,
                name: "新歌一",
                picUrl: "http://p1.music.126.net/s1.jpg",
                song: { id: 2001, name: "新歌一", duration: 210000, artists: [{ id: 10, name: "歌手甲" }] },
              },
            ],
          },
        };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    const items = await handleHome({ filter: "all", page: "1" });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: "1001", mediaType: "playlist", title: "深夜民谣" });
    expect(items[1]).toMatchObject({ id: "2001", mediaType: "song", title: "新歌一", duration: 210 });
  });

  test("handleCharts filters official and global charts", async () => {
    stubHttp(() => ({
      data: {
        code: 200,
        list: [
          { id: 19723756, name: "飙升榜", ToplistType: "S", updateFrequency: "每天更新" },
          { id: 60198, name: "美国Billboard榜", updateFrequency: "每周更新" },
        ],
      },
    }));

    const official = await handleCharts({ category: "official", page: "1" });
    expect(official.map((item) => item.id)).toEqual(["19723756"]);

    const globalCharts = await handleCharts({ category: "global", page: "1" });
    expect(globalCharts.map((item) => item.id)).toEqual(["60198"]);
  });

  test("handleNewReleases loads albums and songs by area", async () => {
    const spy = stubHttp((opts) => {
      if (opts.url.includes("/api/album/new")) {
        return {
          data: {
            code: 200,
            albums: [{ id: 501, name: "新专辑", artists: [{ id: 1, name: "歌手" }] }],
          },
        };
      }
      if (opts.url.includes("/api/v1/discovery/new/songs")) {
        return {
          data: {
            code: 200,
            data: [{ id: 601, name: "新单曲", duration: 190000, artists: [{ id: 1, name: "歌手" }] }],
          },
        };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    const albums = await handleNewReleases({ category: "albums", area: "ZH", page: "1" });
    expect(albums[0]).toMatchObject({ id: "501", mediaType: "album" });
    expect(spy.mock.calls[0]?.[0]?.url).toContain("area=ZH");

    const songs = await handleNewReleases({ category: "songs", area: "JP", page: "1" });
    expect(songs[0]).toMatchObject({ id: "601", mediaType: "song" });
    expect(String(spy.mock.calls[1]?.[0]?.data)).toContain("areaId=8");
  });

  test("handleGenres lists curated categories and loads category playlists", async () => {
    const categories = await handleGenres({});
    expect(categories.length).toBeGreaterThan(10);
    expect(categories[0]).toMatchObject({ mediaType: "genre", link: "ncm:genre:华语" });

    stubHttp(() => ({
      data: {
        code: 200,
        playlists: [{ id: 7001, name: "华语精选", creator: { nickname: "云音乐" } }],
      },
    }));
    const playlists = await handleGenres({ genreId: "ncm:genre:华语", page: "1" });
    expect(playlists).toHaveLength(1);
    expect(playlists[0]).toMatchObject({ id: "7001", mediaType: "playlist", title: "华语精选" });
  });

  test("handleRadios requires cookie for Personal FM and serves queue when authenticated", async () => {
    await expect(handleRadios({ radioId: "ncm:radio:fm:DEFAULT" })).rejects.toThrow("MUSIC_U");

    stubHttp((opts) => {
      if (opts.url.includes("/eapi/v1/radio/get")) {
        return {
          data: {
            code: 200,
            data: [{ id: 8801, name: "漫游曲目", duration: 200000, artists: [{ id: 8, name: "乐队" }] }],
          },
        };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    const songs = await handleRadios({
      cookie: "MUSIC_U=valid_cookie_token_12345678901234567890",
      radioId: "ncm:radio:fm:DEFAULT",
      section: "songs",
    });
    expect(songs).toHaveLength(1);
    expect(songs[0]).toMatchObject({ id: "8801", mediaType: "song", title: "漫游曲目" });
  });

  test("handleArtists supports top artists, profile, songs, and albums", async () => {
    stubHttp((opts) => {
      if (opts.url.includes("/api/artist/top")) {
        return { data: { code: 200, artists: [{ id: 6452, name: "周杰伦" }] } };
      }
      if (opts.url.includes("/api/v1/artist/6452")) {
        return {
          data: {
            code: 200,
            artist: { id: 6452, name: "周杰伦", briefDesc: "华语流行男歌手", musicSize: 300, albumSize: 20 },
            hotSongs: [{ id: 186016, name: "晴天", dt: 269000, ar: [{ id: 6452, name: "周杰伦" }] }],
          },
        };
      }
      if (opts.url.includes("/api/artist/albums/6452")) {
        return {
          data: { code: 200, hotAlbums: [{ id: 18907, name: "叶惠美", artists: [{ id: 6452, name: "周杰伦" }] }] },
        };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    const top = await handleArtists({});
    expect(top[0]).toMatchObject({ id: "6452", type: "person", title: "周杰伦" });

    const profile = await handleArtists({ peopleId: "6452", section: "profile" });
    expect(profile[0]?.description).toContain("华语流行男歌手");

    const songs = await handleArtists({ peopleId: "6452", section: "songs" });
    expect(songs[0]).toMatchObject({ id: "186016", mediaType: "song" });

    const albums = await handleArtists({ peopleId: "6452", section: "albums" });
    expect(albums[0]).toMatchObject({ id: "18907", mediaType: "album" });
  });

  test("handleLibrary requires MUSIC_U and supports liked songs and cloud drive", async () => {
    await expect(handleLibrary({ tab: "liked" })).rejects.toThrow("MUSIC_U");

    stubHttp((opts) => {
      if (opts.url.includes("/api/nuser/account/get")) {
        return { data: { code: 200, profile: { userId: 12345, nickname: "测试用户" } } };
      }
      if (opts.url.includes("/api/user/playlist")) {
        return {
          data: {
            code: 200,
            playlist: [{ id: 90001, name: "我喜欢的音乐", specialType: 5 }],
          },
        };
      }
      if (opts.url.includes("/api/v6/playlist/detail")) {
        return {
          data: {
            code: 200,
            playlist: {
              id: 90001,
              name: "我喜欢的音乐",
              trackIds: [{ id: 111 }, { id: 222 }],
              tracks: [{ id: 111, name: "喜欢的歌1", dt: 180000, ar: [{ id: 1, name: "A" }] }],
            },
          },
        };
      }
      if (opts.url.includes("/api/v3/song/detail")) {
        return {
          data: {
            code: 200,
            songs: [{ id: 222, name: "喜欢的歌2", dt: 200000, ar: [{ id: 2, name: "B" }] }],
          },
        };
      }
      if (opts.url.includes("/eapi/v1/cloud/get")) {
        return {
          data: {
            code: 200,
            data: [{ songId: 333, songName: "云盘歌曲", artist: "本地歌手", album: "云盘" }],
          },
        };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    const cookie = "MUSIC_U=token_for_library_12345678901234567890";
    const liked = await handleLibrary({ cookie, tab: "liked" });
    expect(liked.map((s) => s.id)).toEqual(["111", "222"]);

    const cloud = await handleLibrary({ cookie, tab: "cloud" });
    expect(cloud[0]).toMatchObject({ id: "333", title: "云盘歌曲", mediaType: "song" });
  });

  test("handleSearch supports mixed and filtered searches", async () => {
    stubHttp((opts) => {
      const body = String(opts.data || "");
      if (body.includes("type=1000")) {
        return { data: { code: 200, result: { playlists: [{ id: 44, name: "测试歌单" }] } } };
      }
      if (body.includes("type=100")) {
        return { data: { code: 200, result: { artists: [{ id: 11, name: "测试歌手" }] } } };
      }
      if (body.includes("type=10")) {
        return { data: { code: 200, result: { albums: [{ id: 22, name: "测试专辑", artists: [] }] } } };
      }
      return {
        data: { code: 200, result: { songs: [{ id: 33, name: "测试歌曲", dt: 150000, ar: [] }] } },
      };
    });

    const mixed = await handleSearch({ keyword: "测试", kind: "all", page: "1" });
    expect(mixed.map((item) => item.mediaType)).toEqual(["person", "album", "song", "playlist"]);
  });

  test("handleDetail resolves FLAC stream with -460 fallback, sets playerType app, and filters VIP trials", async () => {
    let v1Calls = 0;
    stubHttp((opts) => {
      if (opts.url.includes("/eapi/song/enhance/player/url/v1")) {
        v1Calls++;
        return {
          data: { code: -460, message: "Cheating" },
          headers: { "set-cookie": "NMTID=refreshed_nmtid; Expires=Thu, 21 Nov 2030 00:00:00 GMT; Path=/" },
        };
      }
      if (opts.url.includes("/eapi/song/enhance/player/url")) {
        return {
          data: {
            code: 200,
            data: [
              {
                id: 186016,
                url: "http://m8.music.126.net/song.flac",
                type: "flac",
                level: "lossless",
                br: 999000,
                code: 200,
                freeTrialInfo: null,
              },
            ],
          },
        };
      }
      if (opts.url.includes("/api/v3/song/detail")) {
        return {
          data: {
            code: 200,
            songs: [{ id: 186016, name: "晴天", dt: 269000, ar: [{ id: 6452, name: "周杰伦" }] }],
          },
        };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    // Sync config with lossless quality
    await handleGenres({ quality: "lossless", playerType: "auto", allowTrial: "false" });
    const detail = await handleDetail("ncm:song:186016");
    expect(v1Calls).toBe(3);
    expect(detail.videoUrl).toBe("https://m8.music.126.net/song.flac");
    expect(detail.playerType).toBe("app");
    expect(detail.customHeaders?.Referer).toBe("https://music.163.com/");
    expect(detail.title).toBe("晴天");

    // Verify trial preview rejection vs allowTrial=true
    rs.restoreAllMocks();
    stubHttp((opts) => {
      if (opts.url.includes("/eapi/song/enhance/player/url/v1")) {
        return {
          data: {
            code: 200,
            data: [
              {
                id: 999001,
                url: "https://m8.music.126.net/trial.mp3",
                type: "mp3",
                level: "exhigh",
                br: 320000,
                code: 200,
                freeTrialInfo: { start: 0, end: 30 },
              },
            ],
          },
        };
      }
      return {
        data: { code: 200, songs: [{ id: 999001, name: "VIP歌", dt: 240000, ar: [{ id: 1, name: "歌手" }] }] },
      };
    });

    await handleGenres({ quality: "exhigh", allowTrial: "false" });
    await expect(handleDetail("ncm:song:999001")).rejects.toThrow("30 秒");

    await handleGenres({ quality: "exhigh", allowTrial: "true" });
    const trialDetail = await handleDetail("ncm:song:999001");
    expect(trialDetail.videoUrl).toBe("https://m8.music.126.net/trial.mp3");
    expect(trialDetail.subtitle).toContain("试听");
  });

  test("handleDetail loads album and playlist tracks", async () => {
    stubHttp((opts) => {
      if (opts.url.includes("/api/v1/album/18907")) {
        return {
          data: {
            code: 200,
            album: {
              id: 18907,
              name: "叶惠美",
              publishTime: Date.UTC(2003, 6, 31),
              artists: [{ id: 6452, name: "周杰伦" }],
            },
            songs: [{ id: 186016, name: "晴天", dt: 269000, ar: [{ id: 6452, name: "周杰伦" }] }],
          },
        };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    const album = await handleDetail("ncm:album:18907");
    expect(album).toMatchObject({ id: "18907", mediaType: "album", title: "叶惠美", releaseDate: "2003-07-31" });
    expect(album.tracks).toHaveLength(1);
    expect(album.tracks?.[0]?.id).toBe("186016");

    await expect(handleDetail("invalid:link")).rejects.toThrow("无法识别");
  });
});
