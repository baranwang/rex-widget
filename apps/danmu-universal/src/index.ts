import "./libs/fetch";
import { DoubanHistory } from "./experimental/douban-history";
import { EMPTY_ANIME_CONFIG, type MediaType, PROVIDER_NAMES } from "./libs/constants";
import { z } from "./libs/zod";
import { DoubanMatcher } from "./matchers/douban";
import { getMediaRefEpisodeParams, reportMediaRefLeads } from "./matchers/mediaref";
import { type GetEpisodeParam, scraper } from "./scrapers";

if (import.meta.rstest) {
  Object.defineProperty(globalThis, "WidgetMetadata", {
    value: undefined,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, "searchDanmu", {
    value: undefined,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, "getDetail", {
    value: undefined,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, "getComments", {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

const widgetVersion = (() => {
  if (process.env.NODE_ENV === "production") {
    return process.env.PACKAGE_VERSION;
  }
  const date = new Date();
  return `0.0.0-${[date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()]
    .map((item) => item.toString().padStart(2, "0"))
    .join("")}`;
})();

WidgetMetadata = {
  id: "baranwang.danmu.universal",
  title: process.env.NODE_ENV === "production" ? "通用弹幕" : "通用弹幕 (测试)",
  description: "通用弹幕插件，支持腾讯、优酷、爱奇艺、哔哩哔哩、人人视频等平台",
  author: "Baran",
  version: widgetVersion,
  site: "https://github.com/baranwang/rex-widget/tree/main/apps/danmu-universal",
  requiredVersion: "0.0.2",
  globalParams: [
    {
      title: "模糊匹配",
      name: "fuzzyMatch",
      description: "是否开启模糊匹配",
      value: "auto",
      type: "enumeration",
      enumOptions: [
        {
          title: "自动",
          value: "auto",
        },
        {
          title: "始终开启",
          value: "always",
        },
        {
          title: "始终关闭",
          value: "never",
        },
      ],
    },
    {
      title: "360 影视搜索（实验性）",
      name: "qihooSearch",
      description: "是否开启 360 影视搜索",
      value: "false",
      type: "enumeration",
      belongTo: {
        paramName: "fuzzyMatch",
        value: ["auto", "always"],
      },
      enumOptions: [
        {
          title: "关闭",
          value: "false",
        },
        {
          title: "开启",
          value: "true",
        },
      ],
    },
    {
      title: "未匹配到资源提示",
      name: "emptyAnimeTitle",
      description: "是否显示未匹配到资源提示",
      value: "true",
      type: "enumeration",
      enumOptions: [
        {
          title: "开启",
          value: "true",
        },
        {
          title: "关闭",
          value: "false",
        },
      ],
    },
    {
      title: "弹幕内容聚合",
      name: "global.content.aggregation",
      value: "true",
      type: "enumeration",
      enumOptions: [
        {
          title: "开启",
          value: "true",
        },
        {
          title: "关闭",
          value: "false",
        },
      ],
    },
    {
      title: "保留弹幕颜色",
      name: "global.content.preserveDanmakuColor",
      description: "关闭后，弹幕统一显示为白色",
      value: "true",
      type: "enumeration",
      enumOptions: [
        {
          title: "开启",
          value: "true",
        },
        {
          title: "关闭",
          value: "false",
        },
      ],
    },
    {
      title: "MediaRef API Key",
      name: "global.mediaRef.apiKey",
      description: "留空使用内置 key；填写后改用自己的 key",
      value: "",
      type: "input",
    },
    {
      title: `[${PROVIDER_NAMES.renren}] 弹幕模式`,
      name: "provider.renren.mode",
      description: "弹幕模式，精选弹幕相比默认弹幕质量更高",
      value: "default",
      type: "enumeration",
      enumOptions: [
        {
          title: "默认",
          value: "default",
        },
        {
          title: "精选",
          value: "choice",
        },
      ],
    },
    {
      title: "豆瓣书影音档案（实验性）",
      name: "global.experimental.doubanHistory.enabled",
      description: "是否开启自动同步豆瓣书影音档案",
      value: "false",
      type: "enumeration",
      enumOptions: [
        {
          title: "关闭",
          value: "false",
        },
        {
          title: "开启",
          value: "true",
        },
      ],
    },
    {
      title: "豆瓣 Cookie 中的 dbcl2 值",
      name: "global.experimental.doubanHistory.dbcl2",
      value: "",
      type: "input",
      belongTo: {
        paramName: "global.experimental.doubanHistory.enabled",
        value: ["true"],
      },
    },
    {
      title: "豆瓣自定义评论",
      name: "global.experimental.doubanHistory.customComment",
      value: "自豪的使用 Rex*",
      type: "input",
      belongTo: {
        paramName: "global.experimental.doubanHistory.enabled",
        value: ["true"],
      },
      placeholders: ["自豪的使用 Rex*", "Marked by Rex*"].map((item) => ({
        title: item,
        value: item,
      })),
    },
  ],
  modules: [
    {
      type: "danmu",
      id: "searchDanmu",
      title: "搜索弹幕",
      functionName: "searchDanmu",
      description: "搜索弹幕",
    },
    {
      type: "danmu",
      id: "getDetail",
      title: "获取详情",
      functionName: "getDetail",
      description: "获取详情",
    },
    {
      type: "danmu",
      id: "getComments",
      title: "获取弹幕",
      functionName: "getComments",
      description: "获取弹幕",
    },
    {
      type: "danmu",
      id: "getDanmuWithSegmentTime",
      title: "获取弹幕切片",
      functionName: "getComments",
      description: "获取弹幕切片",
    },
  ],
};

const checkShowEmptyAnimeTitle = (params: SearchDanmuParams) => {
  if (import.meta.rstest || process.env.RSTEST) {
    return false;
  }
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  return z.stringbool().catch(true).parse(params.emptyAnimeTitle);
};

searchDanmu = async (params) => {
  console.log("searchDanmu params", {
    ...params,
    ...(params["global.mediaRef.apiKey"] ? { "global.mediaRef.apiKey": "[redacted]" } : {}),
  });

  const globalParams = scraper.setGlobalParams(params);

  const { fuzzyMatch = "auto", type: mediaType, episode } = params;

  const addEpisodeNumber = (items: GetEpisodeParam[]) => {
    if (mediaType !== "tv") return items;
    return items.map((item) => ({
      ...item,
      episodeNumber: episode ? parseInt(episode, 10) : item.episodeNumber,
    }));
  };

  const addEpisodeContext = (items: GetEpisodeParam[]) =>
    items.map((item) => ({
      ...item,
      ...(params.episodeName ? { episodeName: params.episodeName.toString() } : {}),
      ...(params.airDate ? { airDate: params.airDate.toString() } : {}),
    }));

  const getMatchedEpisodes = async (items: GetEpisodeParam[], filterByRequestedEpisode = true) => {
    const requestedItems = filterByRequestedEpisode ? addEpisodeNumber(items) : items;
    let matchedEpisodes = await scraper.getEpisodes(...addEpisodeContext(requestedItems));
    if (filterByRequestedEpisode && mediaType === "tv" && episode) {
      matchedEpisodes = matchedEpisodes.filter((item) => item.episodeNumber === parseInt(episode, 10));
    }
    return matchedEpisodes;
  };

  const normalizeDoubanTvCollections = (items: GetEpisodeParam[]) => {
    if (mediaType !== "tv") return items;
    return items.map((item) => {
      if (item.provider !== "tencent") return item;
      try {
        const { cid } = scraper.scraperMap.tencent.parseProviderIdString(item.idString);
        return {
          ...item,
          idString: scraper.scraperMap.tencent.generateIdString({ cid }),
        };
      } catch {
        return item;
      }
    });
  };

  const toSearchResult = (episodes: Awaited<ReturnType<typeof scraper.getEpisodes>>) => ({
    animes: episodes.map((item) => {
      let animeTitle = `[${PROVIDER_NAMES[item.provider as keyof typeof PROVIDER_NAMES]}] `;
      if (item.episodeTitle) {
        animeTitle += item.episodeTitle;
      }
      return {
        animeId: item.episodeId,
        animeTitle,
      };
    }),
  });

  const tmdbId = params.tmdbId ? Number(params.tmdbId) : NaN;
  const isMovieOrTv = mediaType === "tv" || mediaType === "movie";
  const season = mediaType === "tv" && params.season !== undefined ? Number(params.season) : null;
  const mediaRefApiKey = globalParams?.global.mediaRef.apiKey ?? "";
  let mediaRefEpisodeParams: GetEpisodeParam[] = [];
  if (isMovieOrTv && Number.isInteger(tmdbId)) {
    mediaRefEpisodeParams = await getMediaRefEpisodeParams({
      apiKey: mediaRefApiKey,
      type: mediaType,
      tmdbId,
      season,
      episode: episode === undefined ? undefined : Number(episode),
    });
    if (mediaRefEpisodeParams.length) {
      console.log("Found MediaRef episode params", mediaRefEpisodeParams);
      const mediaRefEpisodes = await getMatchedEpisodes(mediaRefEpisodeParams, false);
      if (mediaRefEpisodes.length) return toSearchResult(mediaRefEpisodes);
    }
  }

  let episodesParams: GetEpisodeParam[] = [];

  const doubanMatcher = new DoubanMatcher();
  const { doubanIds, videoPlatformInfo, tmdbMatch } = await doubanMatcher.getEpisodeParams(params);
  episodesParams = episodesParams.concat(normalizeDoubanTvCollections(videoPlatformInfo));

  try {
    if (
      isMovieOrTv &&
      globalParams?.global.experimental.doubanHistory.enabled &&
      globalParams?.global.experimental.doubanHistory.dbcl2
    ) {
      const doubanHistory = new DoubanHistory(globalParams.global.experimental.doubanHistory);
      if (doubanIds.length === 1) {
        await doubanHistory.setStatus(mediaType, doubanIds[0], mediaType === "tv" ? "doing" : "done");
      }
    }
  } catch (error) {
    console.error(error);
  }

  if (fuzzyMatch === "always") {
    const searchEpisodes = await scraper.getEpisodeParams(params);
    episodesParams = episodesParams.concat(searchEpisodes);
  }

  let episodes = await getMatchedEpisodes(episodesParams);
  if (episodes.length && tmdbMatch && isMovieOrTv && Number.isInteger(tmdbId)) {
    // 不等它：上报失败或变慢都不影响返回弹幕。
    void reportMediaRefLeads({
      apiKey: mediaRefApiKey,
      type: mediaType,
      tmdbId,
      season,
      episode: episode === undefined ? undefined : Number(episode),
      doubanId: tmdbMatch.doubanId,
      platforms: tmdbMatch.videoPlatformInfo,
      episodes,
      skipProviders: mediaRefEpisodeParams.map((item) => item.provider),
    });
  }
  if (!episodes.length && fuzzyMatch === "auto") {
    const searchEpisodes = await scraper.getEpisodeParams(params);
    episodes = await getMatchedEpisodes(searchEpisodes);
  }

  if (!episodes.length && checkShowEmptyAnimeTitle(params)) {
    return {
      animes: [
        {
          animeId: EMPTY_ANIME_CONFIG.ID,
          animeTitle: process.env.NODE_ENV === "development" ? JSON.stringify(params) : EMPTY_ANIME_CONFIG.TITLE,
        },
      ],
    };
  }
  return toSearchResult(episodes);
};

getDetail = async (params) => {
  scraper.setGlobalParams(params);

  const { animeId, type: mediaType, episode, episodeName, airDate } = params;
  if (!animeId || animeId === EMPTY_ANIME_CONFIG.ID) {
    return [];
  }

  return scraper.getDetailWithAnimeId(animeId.toString(), mediaType as MediaType, episode, {
    ...(episodeName ? { episodeName: episodeName.toString() } : {}),
    ...(airDate ? { airDate: airDate.toString() } : {}),
  });
};

getComments = async (params) => {
  scraper.setGlobalParams(params);

  const animeId = "animeId" in params ? params.animeId : undefined;
  const segmentTime =
    "segmentTime" in params && params.segmentTime !== undefined ? Number(params.segmentTime) : undefined;
  const videoId = params.commentId ?? animeId;
  if (!videoId || videoId === EMPTY_ANIME_CONFIG.ID) {
    return {
      comments: [],
      count: 0,
    };
  }
  const comments = await scraper.getDanmuWithSegmentTimeByVideoId(videoId.toString(), segmentTime);
  return {
    comments,
    count: comments.length,
  };
};

if (import.meta.rstest) {
  const { beforeAll, expect, test } = import.meta.rstest;

  beforeAll(async () => {
    Widget.storage.clear();
  });

  test("registers widget entrypoints", () => {
    expect(WidgetMetadata.id).toBe("baranwang.danmu.universal");
    expect(typeof searchDanmu).toBe("function");
    expect(typeof getDetail).toBe("function");
    expect(typeof getComments).toBe("function");
  });

  test("注册保留弹幕颜色开关", () => {
    const option = WidgetMetadata.globalParams?.find((param) => param.name === "global.content.preserveDanmakuColor");

    expect(option).toMatchObject({
      title: "保留弹幕颜色",
      name: "global.content.preserveDanmakuColor",
      description: "关闭后，弹幕统一显示为白色",
      value: "true",
      type: "enumeration",
      enumOptions: [
        { title: "开启", value: "true" },
        { title: "关闭", value: "false" },
      ],
    });
    expect(option?.belongTo).toBeUndefined();
  });
}
