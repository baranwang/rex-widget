import { fromJson } from "@bufbuild/protobuf";
import {
  fromProtoMediaDocument,
  PLATFORM_NAMESPACES,
  type PlatformNamespace,
  proto,
  resolveEpisode,
} from "@media-ref/client";
import {
  collectionProviderIdString,
  generateProviderIdString,
  isProviderName,
  parseProviderIdString,
} from "@rexnow/scraper-kit";
import type { MediaType } from "../libs/constants";
import { Fetch } from "../libs/fetch";
import { storage, TTL_1_DAY, TTL_2_HOURS, TTL_7_DAYS } from "../libs/storage";
import type { GetEpisodeParam } from "../scrapers";

const GET_MEDIA_URL = "https://api.mediaref.org/mediaref.v1.MediaService/GetMedia";
const CREATE_CHANGE_REQUEST_URL = "https://api.mediaref.org/mediaref.v1.ChangeRequestService/CreateChangeRequest";
/** Widget.http timeout, in seconds. */
const TIMEOUT_SECONDS = 3;

export interface MediaRefLookupParams {
  apiKey: string;
  type: MediaType | "movie" | "tv";
  tmdbId: number;
  season?: number | null;
  episode?: number;
}

const toIdString = (namespace: PlatformNamespace, nativeId: string): string => {
  switch (namespace) {
    case "tencent":
      return generateProviderIdString("tencent", { cid: nativeId });
    case "youku":
      return generateProviderIdString("youku", { showId: nativeId });
    case "iqiyi":
      return generateProviderIdString("iqiyi", { entityId: nativeId });
    case "bilibili":
      return generateProviderIdString("bilibili", { seasonId: nativeId.replace(/^ss/i, "") });
    case "mgtv":
      return generateProviderIdString("mgtv", { dramaId: nativeId });
  }
};

/**
 * 用 MediaRef 把 TMDB 的季和集换成各平台的合集和分集。
 * 没配 key、没查到、出错都返回空数组，调用方照旧走本地 matcher。
 */
export const getMediaRefEpisodeParams = async ({
  apiKey,
  type,
  tmdbId,
  season,
  episode,
}: MediaRefLookupParams): Promise<GetEpisodeParam[]> => {
  if (!apiKey || !Number.isInteger(tmdbId)) return [];
  const hasSeason = type === "tv" && season !== null && season !== undefined;

  try {
    const response = await new Fetch().post(
      GET_MEDIA_URL,
      {
        ref: { tmdb: { type: type === "tv" ? "MEDIA_TYPE_TV" : "MEDIA_TYPE_MOVIE", id: tmdbId } },
        ...(hasSeason ? { season } : {}),
        namespaceGroup: "NAMESPACE_GROUP_PLATFORM",
      },
      {
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        timeout: TIMEOUT_SECONDS,
        successStatus: [200],
        // 只缓存成功响应；未找到和报错不缓存，下次重试。
        cache: { cacheKey: `mediaref:tmdb:${type}:${tmdbId}:${hasSeason ? season : "-"}`, ttl: TTL_1_DAY },
      },
    );
    const { document } = fromJson(proto.GetMediaResponseSchema, response.data as never, { ignoreUnknownFields: true });
    if (!document) return [];
    const doc = fromProtoMediaDocument(document);
    const query = {
      ...(hasSeason ? { season: season as number } : {}),
      ...(type === "tv" && episode !== undefined ? { episode } : {}),
    };

    return PLATFORM_NAMESPACES.flatMap((namespace): GetEpisodeParam[] => {
      const result = resolveEpisode(doc, { namespace, ...query });
      if (result.kind === "mapped") {
        return [
          {
            provider: namespace,
            idString: toIdString(namespace, result.nativeId),
            episodeNumber: result.targetEpisode,
          },
        ];
      }
      // 整部关联（电影或不分段的合集）：集号不用换算。needs_review / non_linear 不可靠，跳过。
      if (result.kind === "collection_only" && result.reason === "whole_media") {
        return [
          {
            provider: namespace,
            idString: toIdString(namespace, result.nativeId),
            ...(query.episode !== undefined ? { episodeNumber: query.episode } : {}),
          },
        ];
      }
      return [];
    });
  } catch (error) {
    console.error("MediaRef lookup failed", error instanceof Error ? error.message : error);
    return [];
  }
};

/** 平台 idString → MediaRef 规范 nativeId；没有合集 ID 时返回 null。 */
const toNativeId = (provider: string, idString: string): string | null => {
  try {
    switch (provider) {
      case "tencent":
        return parseProviderIdString("tencent", idString).cid;
      case "youku":
        return parseProviderIdString("youku", idString).showId ?? null;
      case "iqiyi":
        return parseProviderIdString("iqiyi", idString).entityId;
      case "bilibili":
        return `ss${parseProviderIdString("bilibili", idString).seasonId}`;
      case "mgtv":
        return parseProviderIdString("mgtv", idString).dramaId;
      default:
        return null;
    }
  } catch {
    return null;
  }
};

const sameCollection = (provider: string, a: string, b: string): boolean => {
  if (!isProviderName(provider)) return false;
  try {
    return collectionProviderIdString(provider, a) === collectionProviderIdString(provider, b);
  } catch {
    return false;
  }
};

export interface MediaRefLeadParams {
  apiKey: string;
  type: MediaType | "movie" | "tv";
  tmdbId: number;
  season?: number | null;
  /** 请求的 TMDB 集号（剧集）。 */
  episode?: number;
  doubanId: string;
  /** 豆瓣给出的平台合集。 */
  platforms: GetEpisodeParam[];
  /** 实际拉到的分集；episodeId 形如 `<provider>:<idString>`。 */
  episodes: { provider: string; episodeId: string; episodeNumber?: number }[];
  /** MediaRef 已经给过的平台，不再上报。 */
  skipProviders: string[];
}

/**
 * 豆瓣命中且确实拉到分集、MediaRef 却没有的平台合集，连同豆瓣条目一起作为变更单交给 MediaRef，
 * 由证据门决定是否生效。失败只打日志。
 * 剧集按整季提交，只核对请求的集在合集里集号不变（排除偏移和跨季接续）。不在这里比集数：
 * scraper 拉合集可能只拿到第一页，平台和 TMDB 更新进度也不同步；集数对不上由证据门转人工审核。
 * shortcut: 只按本机缓存去重（7 天），多个用户会重复提交同一条；MediaRef 有线索接口后改用它。
 */
export const reportMediaRefLeads = async ({
  apiKey,
  type,
  tmdbId,
  season,
  episode,
  doubanId,
  platforms,
  episodes,
  skipProviders,
}: MediaRefLeadParams): Promise<void> => {
  if (!apiKey || !Number.isInteger(tmdbId)) return;
  const isTv = type === "tv";
  if (isTv && (season === null || season === undefined || episode === undefined)) return;
  const segments = isTv ? [{ wholeSeason: { season, baseline: "tmdb" } }] : [];

  const verified = new Map<string, { namespace: string; nativeId: string }>();
  for (const { provider, idString } of platforms) {
    if (skipProviders.includes(provider)) continue;
    const hit = episodes.find(
      (e) => e.provider === provider && sameCollection(provider, e.episodeId.slice(provider.length + 1), idString),
    );
    const nativeId = hit ? toNativeId(provider, idString) : null;
    if (!nativeId) continue;
    if (isTv && hit?.episodeNumber !== episode) continue;
    verified.set(`${provider}:${nativeId}`, { namespace: provider, nativeId });
  }
  if (!verified.size) return;

  const leads = [
    { namespace: "douban", nativeId: doubanId },
    ...[...verified.values()].map((lead) => ({ ...lead, variantDescription: "原声", setDefaultVariant: true })),
  ];
  const target = { tmdb: { type: isTv ? "MEDIA_TYPE_TV" : "MEDIA_TYPE_MOVIE", id: tmdbId } };
  const fetch = new Fetch();

  await Promise.all(
    leads.map(async (lead) => {
      const cacheKey = `mediaref:lead:${type}:${tmdbId}:${isTv ? season : "-"}:${lead.namespace}:${lead.nativeId}`;
      try {
        if (await storage.getJson(cacheKey)) return;
        await fetch.post(
          CREATE_CHANGE_REQUEST_URL,
          { target, ...lead, segments },
          {
            headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
            timeout: TIMEOUT_SECONDS,
            successStatus: [200],
          },
        );
        storage.setJson(cacheKey, true, { ttl: TTL_7_DAYS });
      } catch (error) {
        // 失败（限额、被拒、超时）2 小时后再试，免得反复打满限额。
        storage.setJson(cacheKey, true, { ttl: TTL_2_HOURS });
        console.error("MediaRef lead report failed", lead, error instanceof Error ? error.message : error);
      }
    }),
  );
};
