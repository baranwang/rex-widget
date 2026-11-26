import { fromJson } from "@bufbuild/protobuf";
import {
  fromProtoMediaDocument,
  PLATFORM_NAMESPACES,
  type PlatformNamespace,
  proto,
  resolveEpisode,
} from "@media-ref/client";
import { generateProviderIdString } from "@rexnow/scraper-kit";
import type { MediaType } from "../libs/constants";
import { Fetch } from "../libs/fetch";
import { TTL_1_DAY } from "../libs/storage";
import type { GetEpisodeParam } from "../scrapers";

const GET_MEDIA_URL = "https://api.mediaref.org/mediaref.v1.MediaService/GetMedia";
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
    console.error("MediaRef lookup failed", error);
    return [];
  }
};
