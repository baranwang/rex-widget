import { createDecipheriv } from "node:crypto";
import { afterEach, beforeEach, describe, expect, rs, test } from "@rstest/core";
import { EAPI_KEY, EAPI_OSX_UA, NCM_CLIENTLOG_HOST } from "./constants";
import {
  handleArtists,
  handleBanners,
  handleCharts,
  handleDetail,
  handleGenres,
  handleHome,
  handleLibrary,
  handleNewReleases,
  handlePodcasts,
  handleRadios,
  handleSearch,
  handleSubtitle,
} from "./service";

function decodeEapiParams(body: unknown): { path: string; payload: Record<string, unknown> } {
  const raw = typeof body === "string" ? body.replace(/^params=/, "") : "";
  const decipher = createDecipheriv("aes-128-ecb", Buffer.from(EAPI_KEY, "utf8"), null);
  const decrypted = Buffer.concat([decipher.update(Buffer.from(raw, "hex")), decipher.final()]).toString("utf8");
  const [path, jsonText] = decrypted.split("-36cd479b6b5-");
  return { path, payload: JSON.parse(jsonText) as Record<string, unknown> };
}

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

  test("handleGenres lists curated categories with covers and loads category playlists & artist avatars", async () => {
    stubHttp((opts) => {
      if (opts.url.includes("/eapi/tag/list/get")) {
        return {
          data: {
            code: 200,
            data: [{ tagId: 1028, tagName: "R&B", picUrl: "http://p6.music.126.net/rnb.jpg" }],
          },
        };
      }
      if (opts.url.includes("/eapi/playlist/list")) {
        return {
          data: {
            code: 200,
            playlists: [
              {
                id: 7001,
                name: "华语精选",
                coverImgUrl: "http://p1.music.126.net/zh.jpg?imageView=1&thumbnail=140y140",
              },
            ],
          },
        };
      }
      if (opts.url.includes("/api/playlist/list")) {
        return {
          data: {
            code: 200,
            playlists: [{ id: 7001, name: "华语精选", creator: { nickname: "云音乐" } }],
          },
        };
      }
      if (opts.url.includes("/eapi/style-tag/home/artist")) {
        return {
          data: {
            code: 200,
            data: { artists: [{ id: 8325, name: "林忆莲", img1v1Url: "http://p3.music.126.net/sandy.jpg" }] },
          },
        };
      }
      if (opts.url.includes("/eapi/v1/artist/list")) {
        return {
          data: {
            code: 200,
            artists: [{ id: 6452, name: "周杰伦", img1v1Url: "http://p4.music.126.net/jay.jpg" }],
          },
        };
      }
      if (opts.url.includes("/api/v6/playlist/detail")) {
        return {
          data: {
            code: 200,
            playlist: {
              id: 7001,
              name: "治愈歌单",
              tracks: [{ id: 101, name: "晚安", dt: 200000, ar: [{ id: 9001, name: "治愈歌手" }] }],
              trackIds: [{ id: 101 }],
            },
          },
        };
      }
      if (opts.url.includes("/eapi/batch")) {
        return {
          data: {
            code: 200,
            "/api/v1/artist/9001": {
              artist: { id: 9001, name: "治愈歌手", img1v1Url: "http://p3.music.126.net/heal.jpg" },
            },
          },
        };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    const categories = await handleGenres({});
    expect(categories.length).toBeGreaterThan(10);
    expect(categories[0]).toMatchObject({
      mediaType: "genre",
      link: "ncm:genre:华语",
      posterPath: "https://p1.music.126.net/zh.jpg?param=500y500",
    });
    const rnb = categories.find((c) => c.id === "R&B/Soul");
    expect(rnb?.posterPath).toBe("https://p6.music.126.net/rnb.jpg?param=500y500");

    const playlists = await handleGenres({ genreId: "ncm:genre:华语", page: "1" });
    expect(playlists).toHaveLength(1);
    expect(playlists[0]).toMatchObject({ id: "7001", mediaType: "playlist", title: "华语精选" });

    const rnbArtists = await handleGenres({ genreId: "ncm:genre:R&B/Soul", section: "artists" });
    expect(rnbArtists[0]).toMatchObject({
      id: "8325",
      title: "林忆莲",
      avatar: "https://p3.music.126.net/sandy.jpg?param=500y500",
    });

    const zhArtists = await handleGenres({ genreId: "ncm:genre:华语", section: "artists" });
    expect(zhArtists[0]).toMatchObject({
      id: "6452",
      title: "周杰伦",
      avatar: "https://p4.music.126.net/jay.jpg?param=500y500",
    });

    const healingArtists = await handleGenres({ genreId: "ncm:genre:治愈", section: "artists" });
    expect(healingArtists[0]).toMatchObject({
      id: "9001",
      title: "治愈歌手",
      avatar: "https://p3.music.126.net/heal.jpg?param=500y500",
    });
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

  test("handleHome supports high-quality playlists and historical daily recommendations", async () => {
    stubHttp((opts) => {
      if (opts.url.includes("/eapi/playlist/highquality/list")) {
        return { data: { code: 200, playlists: [{ id: 8801, name: "精品华语" }] } };
      }
      if (opts.url.includes("/eapi/discovery/recommend/songs/history/recent")) {
        return { data: { code: 200, data: { dates: ["2026-11-21"] } } };
      }
      if (opts.url.includes("/eapi/discovery/recommend/songs/history/detail")) {
        return {
          data: {
            code: 200,
            data: { songs: [{ id: 5501, name: "昨日推荐", dt: 210000, ar: [{ id: 1, name: "歌手" }] }] },
          },
        };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    const hq = await handleHome({ filter: "highquality", page: "1" });
    expect(hq[0]).toMatchObject({ id: "8801", mediaType: "playlist", title: "精品华语" });

    await expect(handleHome({ filter: "history_daily" })).rejects.toThrow("MUSIC_U");
    const history = await handleHome({
      cookie: "MUSIC_U=valid_cookie_token_12345678901234567890",
      filter: "history_daily",
    });
    expect(history[0]).toMatchObject({ id: "5501", mediaType: "song", title: "昨日推荐" });
  });

  test("handleCharts supports artist toplist and handleArtists supports category filters and biography", async () => {
    stubHttp((opts) => {
      if (opts.url.includes("/eapi/toplist/artist")) {
        return { data: { code: 200, list: { artists: [{ id: 3684, name: "林俊杰" }] } } };
      }
      if (opts.url.includes("/eapi/v1/artist/list")) {
        return { data: { code: 200, artists: [{ id: 777, name: "筛选乐队" }] } };
      }
      if (opts.url.includes("/api/v1/artist/6452")) {
        return {
          data: {
            code: 200,
            artist: { id: 6452, name: "周杰伦", briefDesc: "简介", musicSize: 300, albumSize: 20 },
          },
        };
      }
      if (opts.url.includes("/eapi/artist/introduction")) {
        return {
          data: {
            code: 200,
            briefDesc: "完整简介",
            introduction: [{ ti: "主要成就", txt: "多次获得金曲奖" }],
          },
        };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    const topArtists = await handleCharts({ category: "artists", artistArea: "ZH", page: "1" });
    expect(topArtists[0]).toMatchObject({ id: "3684", type: "person", title: "林俊杰" });

    const filtered = await handleArtists({ area: "ZH", artistType: "BAND", page: "1" });
    expect(filtered[0]).toMatchObject({ id: "777", type: "person", title: "筛选乐队" });

    const profile = await handleArtists({ peopleId: "6452", section: "profile" });
    expect(profile[0]?.description).toContain("完整简介");
    expect(profile[0]?.description).toContain("主要成就");
  });

  test("handleGenres supports Style Hall (songs/albums/artists) and high-quality tags", async () => {
    stubHttp((opts) => {
      if (opts.url.includes("/eapi/tag/list/get")) {
        return {
          data: {
            code: 200,
            data: [{ tagId: 1000, tagName: "流行", enName: "Pop", picUrl: "http://p1.music.126.net/p.jpg" }],
          },
        };
      }
      if (opts.url.includes("/eapi/style-tag/home/song")) {
        return { data: { code: 200, data: { songs: [{ id: 101, name: "流行热歌", dt: 200000, ar: [] }] } } };
      }
      if (opts.url.includes("/eapi/style-tag/home/artist")) {
        return { data: { code: 200, data: { artists: [{ id: 5781, name: "薛之谦" }] } } };
      }
      if (opts.url.includes("/eapi/style-tag/home/album")) {
        return { data: { code: 200, data: { albums: [{ id: 28539, name: "未完成", artists: [] }] } } };
      }
      if (opts.url.includes("/eapi/style-tag/home/playlist")) {
        return { data: { code: 200, data: { playlist: [{ id: 68458, name: "流行歌单" }] } } };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    const styles = await handleGenres({ source: "styles" });
    expect(styles[0]).toMatchObject({ id: "style:1000", mediaType: "genre", link: "ncm:genre:style:1000" });

    const songs = await handleGenres({ genreId: "ncm:genre:style:1000", section: "songs" });
    expect(songs[0]).toMatchObject({ id: "101", mediaType: "song" });

    const artists = await handleGenres({ genreId: "ncm:genre:style:1000", section: "artists" });
    expect(artists[0]).toMatchObject({ id: "5781", type: "person" });

    const albums = await handleGenres({ genreId: "ncm:genre:style:1000", section: "albums" });
    expect(albums.map((item) => item.mediaType)).toEqual(["album", "playlist"]);
  });

  test("handleRadios supports anonymous running FM and scene FM modes", async () => {
    stubHttp((opts) => {
      if (opts.url.includes("/eapi/radio/sport/get")) {
        return { data: { code: 200, data: [{ id: 7001, name: "燃脂节奏", dt: 195000, ar: [] }] } };
      }
      if (opts.url.includes("/eapi/v1/radio/get")) {
        return { data: { code: 200, data: [{ id: 7002, name: "运动模式曲目", dt: 210000, ar: [] }] } };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    const sport = await handleRadios({ radioId: "ncm:radio:sport" });
    expect(sport[0]).toMatchObject({ id: "7001", mediaType: "song", title: "燃脂节奏" });

    const scene = await handleRadios({
      cookie: "MUSIC_U=valid_cookie_token_12345678901234567890",
      radioId: "ncm:radio:fm:SCENE_EXERCISE",
    });
    expect(scene[0]).toMatchObject({ id: "7002", mediaType: "song", title: "运动模式曲目" });
  });

  test("handlePodcasts, DJ search, and DJ detail resolve playable episodes", async () => {
    stubHttp((opts) => {
      if (opts.url.includes("/eapi/djradio/recommend/v1")) {
        return {
          data: {
            code: 200,
            djRadios: [{ id: 12301, name: "夜谈播客", dj: { nickname: "主播甲" }, category: "情感" }],
          },
        };
      }
      if (opts.url.includes("/eapi/program/toplist/v1")) {
        return {
          data: {
            code: 200,
            toplist: [{ program: { id: 99, name: "热门节目1", mainSong: { id: 346304 }, duration: 1800000 } }],
          },
        };
      }
      if (opts.url.includes("/api/cloudsearch/pc")) {
        return { data: { code: 200, result: { djRadios: [{ id: 12301, name: "夜谈播客" }] } } };
      }
      if (opts.url.includes("/eapi/djradio/v2/get")) {
        return {
          data: { code: 200, data: { id: 12301, name: "夜谈播客", desc: "睡前对谈", dj: { nickname: "主播甲" } } },
        };
      }
      if (opts.url.includes("/eapi/dj/program/byradio")) {
        return {
          data: {
            code: 200,
            programs: [{ id: 99, name: "第一期", mainSong: { id: 346304 }, duration: 1800000 }],
          },
        };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    const podcasts = await handlePodcasts({ category: "recommend", page: "1" });
    expect(podcasts[0]).toMatchObject({ id: "dj:12301", link: "ncm:dj:12301", mediaType: "playlist" });

    const programs = await handlePodcasts({ category: "programs", page: "1" });
    expect(programs[0]).toMatchObject({ id: "346304", link: "ncm:song:346304", mediaType: "song" });

    const searchDj = await handleSearch({ keyword: "夜谈", kind: "dj", page: "1" });
    expect(searchDj[0]).toMatchObject({ id: "dj:12301", link: "ncm:dj:12301" });

    const detail = await handleDetail("ncm:dj:12301");
    expect(detail).toMatchObject({ id: "dj:12301", mediaType: "playlist", title: "夜谈播客" });
    expect(detail.tracks?.[0]).toMatchObject({ id: "346304", link: "ncm:song:346304", title: "第一期" });
  });

  test("handleLibrary supports recent plays and collected albums/artists/podcasts", async () => {
    stubHttp((opts) => {
      if (opts.url.includes("/api/nuser/account/get")) {
        return { data: { code: 200, profile: { userId: 12345, nickname: "测试用户" } } };
      }
      if (opts.url.includes("/eapi/play-record/song/list")) {
        return { data: { code: 200, data: { list: [{ data: { id: 401, name: "最近歌曲", dt: 180000, ar: [] } }] } } };
      }
      if (opts.url.includes("/eapi/album/sublist")) {
        return { data: { code: 200, data: [{ id: 402, name: "收藏专辑", artists: [] }] } };
      }
      if (opts.url.includes("/eapi/artist/sublist")) {
        return { data: { code: 200, data: [{ id: 403, name: "关注歌手" }] } };
      }
      if (opts.url.includes("/eapi/djradio/get/subed")) {
        return { data: { code: 200, djRadios: [{ id: 404, name: "订阅播客" }] } };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    const cookie = "MUSIC_U=token_for_library_12345678901234567890";
    expect((await handleLibrary({ cookie, tab: "recent_songs" }))[0]).toMatchObject({ id: "401", mediaType: "song" });
    expect((await handleLibrary({ cookie, tab: "sub_albums" }))[0]).toMatchObject({ id: "402", mediaType: "album" });
    expect((await handleLibrary({ cookie, tab: "sub_artists" }))[0]).toMatchObject({ id: "403", type: "person" });
    expect((await handleLibrary({ cookie, tab: "sub_podcasts" }))[0]).toMatchObject({
      id: "dj:404",
      link: "ncm:dj:404",
    });
  });

  test("handleDetail enriches song with vivid Android UA, dynamic cover, MV trailer, related songs, and scrobble", async () => {
    const scrobbleCalls: Array<{
      url: string;
      userAgent: string;
      header: Record<string, unknown>;
      logs: Array<{ action: string; json: Record<string, unknown> }>;
    }> = [];
    let vividUserAgent = "";
    stubHttp((opts) => {
      if (opts.url.includes("/eapi/song/enhance/player/url/v1")) {
        vividUserAgent = opts.headers?.["user-agent"] || "";
        return {
          data: {
            code: 200,
            data: [
              {
                id: 436514312,
                url: "https://m8.music.126.net/vivid.mp3",
                type: "mp3",
                level: "vivid",
                br: 999000,
                code: 200,
              },
            ],
          },
        };
      }
      if (opts.url.includes("/api/v3/song/detail")) {
        return {
          data: {
            code: 200,
            songs: [{ id: 436514312, name: "成都", dt: 328000, mv: 5436712, ar: [{ id: 6731, name: "赵雷" }] }],
          },
        };
      }
      if (opts.url.includes("/eapi/v1/discovery/simiSong")) {
        return { data: { code: 200, songs: [{ id: 421563096, name: "我们的时光", dt: 240000, ar: [] }] } };
      }
      if (opts.url.includes("/eapi/songplay/dynamic-cover")) {
        return { data: { code: 200, data: { videoPlayUrl: "http://vod.music.126.net/motion.mp4" } } };
      }
      if (opts.url.includes("/eapi/song/enhance/play/mv/url")) {
        return { data: { code: 200, data: { url: "http://vod.music.126.net/mv.mp4" } } };
      }
      if (opts.url.includes("/eapi/feedback/weblog")) {
        const decoded = decodeEapiParams(opts.data);
        scrobbleCalls.push({
          url: opts.url,
          userAgent: opts.headers?.["user-agent"] || "",
          header: (decoded.payload.header ?? {}) as Record<string, unknown>,
          logs: JSON.parse(String(decoded.payload.logs || "[]")) as Array<{
            action: string;
            json: Record<string, unknown>;
          }>,
        });
        return { data: { code: 200, data: "success" } };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    await handleGenres({
      cookie: "MUSIC_U=svip_cookie_token_12345678901234567890",
      quality: "vivid",
      reportHistory: "true",
    });
    const detail = await handleDetail("ncm:song:436514312");
    expect(vividUserAgent).toContain("NeteaseMusic/9.5.61");
    expect(detail.albumMotionArtwork).toBe("https://vod.music.126.net/motion.mp4");
    expect(detail.trailers?.[0]?.videoUrl).toBe("https://vod.music.126.net/mv.mp4");
    expect(detail.relatedItems?.[0]).toMatchObject({ id: "421563096", title: "我们的时光" });

    expect(scrobbleCalls).toHaveLength(2);
    for (const call of scrobbleCalls) {
      expect(call.url).toBe(`${NCM_CLIENTLOG_HOST}/eapi/feedback/weblog`);
      expect(call.userAgent).toBe(EAPI_OSX_UA);
      expect(call.header).toMatchObject({ os: "osx", appver: "3.1.10.5100" });
    }
    expect(scrobbleCalls[0]?.logs).toEqual([
      {
        action: "startplay",
        json: {
          id: "436514312",
          type: "song",
          mainsite: "1",
          mainsiteWeb: "1",
          content: "id=0",
        },
      },
    ]);
    expect(scrobbleCalls[1]?.logs).toEqual([
      {
        action: "play",
        json: {
          id: "436514312",
          type: "song",
          mainsite: "1",
          mainsiteWeb: "1",
          content: "id=0",
          download: 0,
          end: "playend",
          sourceId: "0",
          time: 328,
          wifi: 0,
          source: "list",
        },
      },
    ]);
  });

  test("handleDetail enriches playlist with genreItems and related playlists", async () => {
    stubHttp((opts) => {
      if (opts.url.includes("/api/v6/playlist/detail")) {
        return {
          data: {
            code: 200,
            playlist: {
              id: 68458,
              name: "流行精选",
              tags: ["流行", "华语"],
              tracks: [{ id: 1, name: "歌1", dt: 180000, ar: [] }],
              trackIds: [{ id: 1 }],
            },
          },
        };
      }
      if (opts.url.includes("/eapi/playlist/detail/rcmd/get")) {
        return {
          data: {
            code: 200,
            data: { recPlaylist: [{ playlist: { id: 99999, name: "相关推荐歌单" } }] },
          },
        };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    const detail = await handleDetail("ncm:playlist:68458");
    expect(detail.genreItems).toEqual([
      { id: "ncm:genre:流行", title: "流行" },
      { id: "ncm:genre:华语", title: "华语" },
    ]);
    expect(detail.relatedItems?.[0]).toMatchObject({ id: "99999", title: "相关推荐歌单" });
  });

  test("handleSubtitle resolves lyrics by link and falls back to title search", async () => {
    stubHttp((opts) => {
      if (opts.url.includes("/api/cloudsearch/pc")) {
        return {
          data: { code: 200, result: { songs: [{ id: 536622304, name: "Lemon", dt: 255000, ar: [] }] } },
        };
      }
      if (opts.url.includes("/eapi/song/lyric")) {
        return {
          data: {
            code: 200,
            lrc: { lyric: "[00:01.00]夢ならばどれほどよかったでしょう" },
            tlyric: { lyric: "[00:01.00]如果这一切都是梦境该有多好" },
            romalrc: { lyric: "[00:01.00]yume naraba dore hodo yokatta deshou" },
          },
        };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    const byLink = await handleSubtitle({ link: "ncm:song:536622304" });
    expect(byLink).toHaveLength(4);
    expect(byLink[0]?.id).toBe("ncm:lyric:536622304:bilingual");

    const byTitle = await handleSubtitle({ title: "Lemon", seriesName: "米津玄師" });
    expect(byTitle[0]?.id).toBe("ncm:lyric:536622304:bilingual");
  });

  test("handleSearch supports lyric search, voice search, and empty-keyword hot search detail", async () => {
    stubHttp((opts) => {
      if (opts.url.includes("/eapi/hotsearchlist/get")) {
        return {
          data: {
            code: 200,
            data: [{ searchWord: "晴天", content: "经典华语热搜", score: 99800 }],
          },
        };
      }
      if (opts.url.includes("/eapi/search/voice/get")) {
        return {
          data: {
            code: 200,
            data: {
              resources: [
                {
                  baseInfo: {
                    id: 2540032593,
                    name: "睡前故事 01",
                    mainSong: { id: 2134750848 },
                    duration: 296000,
                    dj: { nickname: "主播乙" },
                    radio: { name: "哄睡电台" },
                  },
                },
              ],
            },
          },
        };
      }
      if (opts.url.includes("/api/cloudsearch/pc")) {
        const body = String(opts.data || "");
        if (body.includes("type=1006")) {
          return {
            data: {
              code: 200,
              result: {
                songs: [
                  {
                    id: 186016,
                    name: "晴天",
                    dt: 269000,
                    ar: [{ id: 6452, name: "周杰伦" }],
                    lyrics: ["<b>刮风这天我试过握着你手</b>", "但偏偏雨渐渐大到我看你不见"],
                  },
                ],
              },
            },
          };
        }
        return {
          data: {
            code: 200,
            result: { songs: [{ id: 186016, name: "晴天", dt: 269000, ar: [{ id: 6452, name: "周杰伦" }] }] },
          },
        };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    const hotList = await handleSearch({ keyword: "" });
    expect(hotList[0]).toMatchObject({
      id: "hot:1",
      mediaType: "playlist",
      title: "1. 晴天",
      subtitle: "经典华语热搜",
      link: "ncm:hot:%E6%99%B4%E5%A4%A9",
    });

    const hotDetail = await handleDetail(hotList[0].link || "");
    expect(hotDetail).toMatchObject({ mediaType: "playlist", title: "晴天" });
    expect(hotDetail.tracks?.[0]).toMatchObject({ id: "186016", title: "晴天" });

    const byLyrics = await handleSearch({ keyword: "刮风这天", kind: "lyrics", page: "1" });
    expect(byLyrics[0]).toMatchObject({
      id: "186016",
      mediaType: "song",
      description: "刮风这天我试过握着你手\n但偏偏雨渐渐大到我看你不见",
    });

    const voices = await handleSearch({ keyword: "睡前故事", kind: "voices", page: "1" });
    expect(voices[0]).toMatchObject({
      id: "2134750848",
      mediaType: "song",
      link: "ncm:song:2134750848",
      title: "睡前故事 01",
    });
  });

  test("handleBanners supports selectable client types, filters web ads, and hydrates songs/albums/playlists", async () => {
    stubHttp((opts) => {
      if (opts.url.includes("/eapi/v2/banner/get")) {
        return {
          data: {
            code: 200,
            banners: [
              {
                targetId: 0,
                targetType: 3000,
                typeTitle: "独家策划",
                pic: "http://p1.music.126.net/ad.jpg",
              },
              {
                targetId: 1001,
                targetType: 1,
                typeTitle: "新歌首发",
                pic: "http://p1.music.126.net/banner_song.jpg",
                song: {
                  id: 1001,
                  name: "焦点新歌",
                  dt: 210000,
                  ar: [{ id: 10, name: "歌手甲" }],
                  al: { id: 20, name: "专辑甲", picUrl: "http://p3.music.126.net/al1.jpg" },
                },
              },
              {
                targetId: 1002,
                targetType: 1,
                typeTitle: "热歌推荐",
                imageUrl: "http://p1.music.126.net/banner_pc_song.jpg",
              },
              {
                targetId: 4090,
                targetType: 10,
                typeTitle: "新碟首发",
                pic: "http://p1.music.126.net/banner_album.jpg",
              },
              {
                targetId: 9246,
                targetType: 1000,
                typeTitle: "歌单",
                pic: "http://p1.music.126.net/banner_pl.jpg",
              },
            ],
          },
        };
      }
      if (opts.url.includes("/api/v3/song/detail")) {
        return {
          data: {
            code: 200,
            songs: [{ id: 1002, name: "PC焦点歌曲", dt: 180000, ar: [{ id: 11, name: "歌手乙" }] }],
          },
        };
      }
      if (opts.url.includes("/api/v1/album/4090")) {
        return {
          data: {
            code: 200,
            album: {
              id: 4090,
              name: "焦点新碟",
              picUrl: "http://p3.music.126.net/alb_sq.jpg",
              artists: [{ id: 12, name: "歌手丙" }],
            },
          },
        };
      }
      if (opts.url.includes("/api/v6/playlist/detail")) {
        return {
          data: {
            code: 200,
            playlist: {
              id: 9246,
              name: "焦点歌单",
              coverImgUrl: "http://p3.music.126.net/pl_sq.jpg",
              creator: { nickname: "云音乐" },
            },
          },
        };
      }
      throw new Error(`Unexpected URL: ${opts.url}`);
    });

    const items = await handleBanners({ clientType: "pc", page: "1" });
    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({
      id: "1001",
      mediaType: "song",
      title: "焦点新歌",
      subtitle: "新歌首发 · 歌手甲",
      backdropPath: "https://p1.music.126.net/banner_song.jpg",
      posterPath: "https://p3.music.126.net/al1.jpg?param=500y500",
    });
    expect(items[1]).toMatchObject({
      id: "1002",
      mediaType: "song",
      title: "PC焦点歌曲",
      backdropPath: "https://p1.music.126.net/banner_pc_song.jpg",
    });
    expect(items[2]).toMatchObject({
      id: "4090",
      mediaType: "album",
      title: "焦点新碟",
      backdropPath: "https://p1.music.126.net/banner_album.jpg",
      posterPath: "https://p3.music.126.net/alb_sq.jpg?param=500y500",
    });
    expect(items[3]).toMatchObject({
      id: "9246",
      mediaType: "playlist",
      title: "焦点歌单",
      backdropPath: "https://p1.music.126.net/banner_pl.jpg",
      posterPath: "https://p3.music.126.net/pl_sq.jpg?param=500y500",
    });
  });
});
