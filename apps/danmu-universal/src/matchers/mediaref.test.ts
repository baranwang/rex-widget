import { afterEach, beforeEach, describe, expect, rs, test } from "@rstest/core";
import "../index";
import { initializeFetchAdapter } from "../libs/fetch";
import { scraper } from "../scrapers";
import { DoubanMatcher } from "./douban";
import { getMediaRefEpisodeParams } from "./mediaref";

type Seg = {
  season: number;
  episodeStart: number;
  episodeEnd?: number;
  targetEpisodeStart: number;
  needsReview?: boolean;
};
type Assoc = { namespace: string; nativeId: string; segments?: Seg[]; status?: string };

/** Connect JSON GetMediaResponse，baseline 为 tmdb。 */
const mediaRefResponse = (type: "tv" | "movie", associations: Assoc[]) => {
  const namespaces = [...new Set(associations.map((a) => a.namespace))];
  return {
    data: {
      document: {
        media: {
          id: "m1",
          type: type === "tv" ? "MEDIA_TYPE_TV" : "MEDIA_TYPE_MOVIE",
          baseline: "tmdb",
          snapshot: { title: "测试", type: type === "tv" ? "MEDIA_TYPE_TV" : "MEDIA_TYPE_MOVIE" },
        },
        variants: namespaces.map((ns) => ({ id: `v-${ns}`, namespace: ns, label: "默认", isDefault: true })),
        associations: associations.map((a, i) => ({
          id: `a${i}`,
          namespace: a.namespace,
          nativeId: a.nativeId,
          variantId: `v-${a.namespace}`,
          status: a.status ?? "ASSOCIATION_STATUS_CONFIRMED",
          segments: (a.segments ?? []).map((s) => ({ ...s, baseline: "tmdb" })),
        })),
      },
    },
    statusCode: 200,
    headers: {},
  };
};

const realAdapter = { get: Widget.http.get.bind(Widget.http), post: Widget.http.post.bind(Widget.http) };

/** Fetch 在导入时已绑定 Widget.http，所以直接换掉适配器的 post。 */
const mockPost = () => {
  const post = rs.fn();
  initializeFetchAdapter({ ...realAdapter, post });
  return post;
};

beforeEach(() => {
  Widget.storage.clear();
});

afterEach(() => {
  rs.restoreAllMocks();
  initializeFetchAdapter(realAdapter);
});

describe("getMediaRefEpisodeParams", () => {
  test("单季直映，请求带 key、超时和平台分组", async () => {
    const post = mockPost().mockResolvedValueOnce(
      mediaRefResponse("tv", [
        {
          namespace: "tencent",
          nativeId: "mzc00200mp8vo9b",
          segments: [{ season: 1, episodeStart: 1, targetEpisodeStart: 1 }],
        },
      ]) as never,
    );

    const result = await getMediaRefEpisodeParams({ apiKey: "k", type: "tv", tmdbId: 100, season: 1, episode: 5 });

    expect(result).toEqual([{ provider: "tencent", idString: "cid=mzc00200mp8vo9b", episodeNumber: 5 }]);
    const [url, body, options] = post.mock.calls[0] as unknown as [
      string,
      unknown,
      { headers: Record<string, string>; timeout: number },
    ];
    expect(url).toBe("https://api.mediaref.org/mediaref.v1.MediaService/GetMedia");
    expect(body).toEqual({
      ref: { tmdb: { type: "MEDIA_TYPE_TV", id: 100 } },
      season: 1,
      namespaceGroup: "NAMESPACE_GROUP_PLATFORM",
    });
    expect(options.headers["X-API-Key"]).toBe("k");
    expect(options.timeout).toBe(3);
  });

  test("一个合集横跨两季：S2E3 按 segments 换算成合集第 15 集", async () => {
    mockPost().mockResolvedValueOnce(
      mediaRefResponse("tv", [
        {
          namespace: "bilibili",
          nativeId: "ss28770",
          segments: [
            { season: 1, episodeStart: 1, episodeEnd: 12, targetEpisodeStart: 1 },
            { season: 2, episodeStart: 1, episodeEnd: 12, targetEpisodeStart: 13 },
          ],
        },
      ]) as never,
    );

    const result = await getMediaRefEpisodeParams({ apiKey: "k", type: "tv", tmdbId: 101, season: 2, episode: 3 });

    expect(result).toEqual([{ provider: "bilibili", idString: "seasonId=28770", episodeNumber: 15 }]);
  });

  test("一季拆成两个合集：后半段落到第二个合集", async () => {
    mockPost().mockResolvedValueOnce(
      mediaRefResponse("tv", [
        {
          namespace: "iqiyi",
          nativeId: "5328486914190101",
          segments: [{ season: 1, episodeStart: 1, episodeEnd: 12, targetEpisodeStart: 1 }],
        },
        {
          namespace: "iqiyi",
          nativeId: "5328486914190201",
          segments: [{ season: 1, episodeStart: 13, targetEpisodeStart: 1 }],
        },
      ]) as never,
    );

    const result = await getMediaRefEpisodeParams({ apiKey: "k", type: "tv", tmdbId: 102, season: 1, episode: 15 });

    expect(result).toEqual([{ provider: "iqiyi", idString: "entityId=5328486914190201", episodeNumber: 3 }]);
  });

  test("电影整部关联：不带集号", async () => {
    mockPost().mockResolvedValueOnce(
      mediaRefResponse("movie", [
        { namespace: "youku", nativeId: "cc001f06962411de83b1" },
        { namespace: "mgtv", nativeId: "510924" },
      ]) as never,
    );

    const result = await getMediaRefEpisodeParams({ apiKey: "k", type: "movie", tmdbId: 103 });

    expect(result).toEqual([
      { provider: "youku", idString: "showId=cc001f06962411de83b1" },
      { provider: "mgtv", idString: "dramaId=510924" },
    ]);
  });

  test("需审核、未确认、集号越界都不算", async () => {
    mockPost().mockResolvedValueOnce(
      mediaRefResponse("tv", [
        {
          namespace: "tencent",
          nativeId: "mzc00200mp8vo9b",
          segments: [{ season: 1, episodeStart: 1, targetEpisodeStart: 1, needsReview: true }],
        },
        {
          namespace: "youku",
          nativeId: "cc001f06962411de83b1",
          status: "ASSOCIATION_STATUS_SEED_UNCONFIRMED",
          segments: [{ season: 1, episodeStart: 1, targetEpisodeStart: 1 }],
        },
        {
          namespace: "mgtv",
          nativeId: "510924",
          segments: [{ season: 1, episodeStart: 1, episodeEnd: 3, targetEpisodeStart: 1 }],
        },
      ]) as never,
    );

    expect(await getMediaRefEpisodeParams({ apiKey: "k", type: "tv", tmdbId: 104, season: 1, episode: 5 })).toEqual([]);
  });

  test("成功响应会缓存", async () => {
    const post = mockPost().mockResolvedValue(
      mediaRefResponse("tv", [
        { namespace: "mgtv", nativeId: "510924", segments: [{ season: 1, episodeStart: 1, targetEpisodeStart: 1 }] },
      ]) as never,
    );
    const params = { apiKey: "k", type: "tv" as const, tmdbId: 105, season: 1, episode: 2 };

    await getMediaRefEpisodeParams(params);
    expect(await getMediaRefEpisodeParams(params)).toEqual([
      { provider: "mgtv", idString: "dramaId=510924", episodeNumber: 2 },
    ]);
    expect(post).toHaveBeenCalledOnce();
  });

  test("报错或超时返回空数组，且不缓存", async () => {
    const post = mockPost()
      .mockRejectedValueOnce(new Error("HTTP 500"))
      .mockRejectedValueOnce(new Error("The operation was aborted"));
    const params = { apiKey: "k", type: "tv" as const, tmdbId: 106, season: 1, episode: 1 };

    expect(await getMediaRefEpisodeParams(params)).toEqual([]);
    expect(await getMediaRefEpisodeParams(params)).toEqual([]);
    expect(post).toHaveBeenCalledTimes(2);
  });

  test("没有 key 不发请求", async () => {
    const post = mockPost();
    expect(await getMediaRefEpisodeParams({ apiKey: "", type: "tv", tmdbId: 107, season: 1, episode: 1 })).toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });
});

describe("searchDanmu 接入 MediaRef", () => {
  const tencentEpisode = {
    provider: "tencent",
    episodeId: "tencent:cid=mzc00200mp8vo9b&vid=v15",
    episodeTitle: "第15集",
    episodeNumber: 15,
  };

  test("MediaRef 命中就直接返回，不再走豆瓣", async () => {
    mockPost().mockResolvedValueOnce(
      mediaRefResponse("tv", [
        {
          namespace: "tencent",
          nativeId: "mzc00200mp8vo9b",
          segments: [{ season: 2, episodeStart: 1, targetEpisodeStart: 13 }],
        },
      ]) as never,
    );
    const douban = rs.spyOn(DoubanMatcher.prototype, "getEpisodeParams");
    const getEpisodes = rs.spyOn(scraper, "getEpisodes").mockResolvedValueOnce([tencentEpisode]);

    const result = await searchDanmu({
      type: "tv",
      tmdbId: "200",
      season: "2",
      episode: "3",
      "global.mediaRef.apiKey": "user-key",
    } as SearchDanmuParams);

    expect(getEpisodes).toHaveBeenCalledWith({
      provider: "tencent",
      idString: "cid=mzc00200mp8vo9b",
      episodeNumber: 15,
    });
    expect(douban).not.toHaveBeenCalled();
    expect(result?.animes).toEqual([{ animeId: tencentEpisode.episodeId, animeTitle: "[腾讯视频] 第15集" }]);
  });

  test.each([
    ["未映射", () => mockPost().mockResolvedValueOnce(mediaRefResponse("tv", []) as never)],
    ["报错", () => mockPost().mockRejectedValueOnce(new Error("HTTP 503"))],
  ])("MediaRef %s时退回豆瓣", async (_, arrange) => {
    arrange();
    rs.spyOn(DoubanMatcher.prototype, "getEpisodeParams").mockResolvedValueOnce({
      doubanIds: [],
      videoPlatformInfo: [{ provider: "tencent", idString: "cid=mzc00200mp8vo9b" }],
    });
    const getEpisodes = rs.spyOn(scraper, "getEpisodes").mockResolvedValueOnce([tencentEpisode]);

    const result = await searchDanmu({
      type: "tv",
      tmdbId: "201",
      season: "1",
      episode: "15",
      fuzzyMatch: "never",
      "global.mediaRef.apiKey": "user-key",
    } as SearchDanmuParams);

    expect(getEpisodes).toHaveBeenCalledWith({
      provider: "tencent",
      idString: "cid=mzc00200mp8vo9b",
      episodeNumber: 15,
    });
    expect(result?.animes).toHaveLength(1);
  });
});
