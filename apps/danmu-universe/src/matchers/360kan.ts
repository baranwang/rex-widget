import { type EpisodeMatchContext, normalizeAirDate, parseVarietyEpisodeIdentity } from "@forward-widget/scraper-kit";
import { compact } from "es-toolkit";
import parseUrl from "url-parse";
import { MediaType, searchDanmuParamsSchema } from "../libs/constants";
import { Fetch } from "../libs/fetch";
import { Logger } from "../libs/logger";
import { TTL_2_HOURS } from "../libs/storage";
import { z } from "../libs/zod";
import { type GetEpisodeParam, scraper } from "../scrapers";

const qihooEpisodePlaylinkSchema = z.object({
  url: z.string(),
  name: z.string().optional(),
  pubdate: z.string().optional(),
  period: z.string().optional(),
});

type QihooEpisodePlaylink = z.infer<typeof qihooEpisodePlaylinkSchema>;

type QihooEpisodeMatchContext = EpisodeMatchContext & {
  requireAirDate?: boolean;
};

type QihooSearchAttempt = {
  keyword: string;
  fallbackToken?: string;
  year?: string;
};

export const buildQihooSearchAttempts = (
  seriesName: string,
  season?: number,
  airDate?: string,
  episodeName?: string,
): QihooSearchAttempt[] => {
  const attempts: QihooSearchAttempt[] = [
    {
      keyword: `${seriesName} ${season && season > 1 ? season : ""}`.trim(),
    },
  ];
  if (parseVarietyEpisodeIdentity(episodeName ?? "").episodeNumber === null) return attempts;
  const year = normalizeAirDate(airDate)?.slice(0, 4);
  const compactTitle = seriesName.replace(/[\s·:：,，。！？!?.、\-—_]/g, "");
  if (!year || compactTitle.length < 2) return attempts;

  const fallbackTokens = [compactTitle.slice(-3), compactTitle.slice(-2)];
  for (const fallbackToken of fallbackTokens) {
    if (fallbackToken.length < 2) continue;
    const keyword = `${fallbackToken} ${year}`;
    if (attempts.some((attempt) => attempt.keyword === keyword)) continue;
    attempts.push({ keyword, fallbackToken, year });
  }
  return attempts;
};

export const matchesQihooSeason = (title: string, season?: number) => {
  if (!season) return true;
  const seasonText = title.match(/第\s*([0-9零〇一二两三四五六七八九十百千万萬]+)\s*季/)?.[1];
  const resultSeason = seasonText ? parseVarietyEpisodeIdentity(`第${seasonText}期`).episodeNumber : null;
  return resultSeason === null ? season <= 1 : resultSeason === season;
};

const normalizeQihooSeriesTitle = (value: string) =>
  value
    .replace(
      /第\s*([0-9零〇一二两三四五六七八九十百千万萬]+)\s*季/g,
      (_match, seasonText: string) =>
        parseVarietyEpisodeIdentity(`第${seasonText}期`).episodeNumber?.toString() ?? seasonText,
    )
    .replace(/[\s·:：,，。！？!?.、\-—_]/g, "");

export const parseQihooTencentUrl = (url: string) => {
  const urlObj = parseUrl(url, true);
  const withVidMatch = urlObj.pathname.match(/^\/x\/cover\/([^/]+)\/([^/.]+)\.html$/);
  if (withVidMatch) {
    return { cid: withVidMatch[1], vid: withVidMatch[2] };
  }

  const cidOnlyMatch = urlObj.pathname.match(/^\/x\/cover\/([^/.]+)\.html$/);
  if (cidOnlyMatch) {
    return { cid: cidOnlyMatch[1] };
  }

  const { cid, vid } = urlObj.query;
  return cid ? { cid, ...(vid ? { vid } : {}) } : null;
};

export const parseQihooYoukuUrl = (url: string) => {
  const urlObj = parseUrl(url, true);
  const showId = urlObj.query.showid || urlObj.query.showId || urlObj.query.s;
  const vid = urlObj.query.vid || urlObj.pathname.match(/^\/v_show\/id_(.+)\.html$/)?.[1];
  return showId || vid ? { ...(showId ? { showId } : {}), ...(vid ? { vid } : {}) } : null;
};

export const parseQihooMgtvUrl = (url: string) => {
  const urlObj = parseUrl(url, true);
  const videoMatch = urlObj.pathname.match(/^\/b\/([^/]+)\/([^/.]+)\.html$/);
  if (videoMatch) {
    return { dramaId: videoMatch[1], videoId: videoMatch[2] };
  }
  const dramaMatch = urlObj.pathname.match(/^\/h\/([^/.]+)\.html$/);
  return dramaMatch ? { dramaId: dramaMatch[1] } : null;
};

export const selectQihooPlaylinkUrl = (
  value: string | QihooEpisodePlaylink[] | undefined,
  episodeNumber?: number,
  context: QihooEpisodeMatchContext = {},
) => {
  if (typeof value === "string") return value;
  if (!value?.length) return undefined;

  const requestedIdentity = parseVarietyEpisodeIdentity(context.episodeName ?? "");
  const requestedAirDate = normalizeAirDate(context.airDate);
  const sourceEpisodeNumber = requestedIdentity.episodeNumber ?? episodeNumber;
  let matchedSourceIssue = false;
  let candidates = value
    .map((item, index) => ({
      ...item,
      index,
      identity: parseVarietyEpisodeIdentity(item.name ?? ""),
      airDate: normalizeAirDate(item.pubdate ?? item.period),
    }))
    .filter((item) => item.identity.edition !== "preview");
  if (!candidates.length) return undefined;

  if (sourceEpisodeNumber !== undefined) {
    const sameIssue = candidates.filter((item) => item.identity.episodeNumber === sourceEpisodeNumber);
    if (sameIssue.length) {
      candidates = sameIssue;
      matchedSourceIssue = true;
    } else if (
      requestedIdentity.episodeNumber !== null ||
      candidates.some((item) => item.identity.episodeNumber !== null) ||
      !requestedAirDate
    ) {
      return undefined;
    }
  }

  if (requestedIdentity.edition !== "main") {
    const sameEdition = candidates.filter((item) => item.identity.edition === requestedIdentity.edition);
    if (!sameEdition.length) return undefined;
    candidates = sameEdition;
  } else {
    const main = candidates.filter((item) => item.identity.edition === "main");
    if (!main.length) return undefined;
    candidates = main;
  }

  if (requestedIdentity.part !== "whole") {
    const samePart = candidates.filter((item) => item.identity.part === requestedIdentity.part);
    if (!samePart.length) return undefined;
    candidates = samePart;
  } else {
    const whole = candidates.filter((item) => item.identity.part === "whole");
    if (whole.length) candidates = whole;
  }

  if (context.requireAirDate || (requestedAirDate && requestedIdentity.episodeNumber === null && !matchedSourceIssue)) {
    if (!requestedAirDate) return undefined;
    const sameDate = candidates.filter((item) => item.airDate === requestedAirDate);
    if (!sameDate.length) return undefined;
    candidates = sameDate;
  }

  return candidates.sort((left, right) => left.index - right.index)[0]?.url;
};

export const qihooVarietyEpisodeResponseSchema = z
  .object({
    data: z.object({
      list: z.array(qihooEpisodePlaylinkSchema),
      total: z.coerce.number().optional().default(0),
    }),
  })
  .transform((value) => value.data);

export const qihooSearchResponseSchema = z
  .object({
    data: z.object({
      longData: z.union([
        z.object({
          rows: z
            .array(
              z.unknown().transform(
                (v) =>
                  z
                    .object({
                      cat_id: z.enum(["1", "2", "3", "4"]),
                      id: z.string(),
                      en_id: z.string(),
                      cat_name: z.string(),
                      titleTxt: z.string(),
                      year: z.string().optional(),
                      playlinks_total: z.record(z.string(), z.coerce.number()).optional(),
                      playlinks: z
                        .record(z.string(), z.union([z.string(), z.array(qihooEpisodePlaylinkSchema)]))
                        .optional(),
                    })
                    .safeParse(v).data ?? null,
              ),
            )
            .transform((v) => compact(v)),
        }),
        z.array(z.unknown()).transform(() => ({ rows: [] })),
      ]),
    }),
  })
  .transform((v) => v.data.longData.rows);

export class QihooMatcher {
  private logger = new Logger("360");

  private fetch = new Fetch();

  private BASE_API = "https://api.so.360kan.com";

  private async selectVarietyUrl(
    item: z.infer<typeof qihooSearchResponseSchema>[number],
    site: string,
    episodeNumber: number | undefined,
    context: QihooEpisodeMatchContext,
  ) {
    const summary = item.playlinks?.[site];
    const summaryUrl = selectQihooPlaylinkUrl(summary, episodeNumber, context);
    if (summaryUrl || item.cat_id !== "3" || typeof summary === "string") {
      return summaryUrl;
    }

    const pageSize = 20;
    const reportedTotal = item.playlinks_total?.[site];
    if (!reportedTotal && !Array.isArray(summary)) return undefined;
    const boundedTotal = Math.min(reportedTotal ?? pageSize, 100);
    for (let offset = 0; offset < boundedTotal; offset += pageSize) {
      const response = await this.fetch.get(`${this.BASE_API}/episodeszongyi`, {
        params: {
          entid: item.id,
          site,
          y: item.year ?? "",
          count: pageSize,
          offset,
        },
        schema: qihooVarietyEpisodeResponseSchema,
        cache: {
          cacheKey: `360:variety:${item.id}:${site}:${item.year ?? ""}:${offset}`,
          ttl: TTL_2_HOURS,
        },
      });
      const playlinks = response.data?.list ?? [];
      const matchedUrl = selectQihooPlaylinkUrl(playlinks, episodeNumber, context);
      if (matchedUrl) return matchedUrl;

      const total = Math.min(response.data?.total ?? boundedTotal, 100);
      if (!playlinks.length || offset + pageSize >= total) break;
    }
    return undefined;
  }

  public async getEpisodeParams(params: SearchDanmuParams) {
    const { success, data, error } = searchDanmuParamsSchema.safeParse(params);
    if (!success) {
      this.logger.error("搜索参数无效，错误：", z.prettifyError(error));
      return [];
    }
    const { seriesName, season, type: mediaType, episode: episodeNumber } = data;
    if (!seriesName) {
      return [];
    }

    const results: GetEpisodeParam[] = [];
    const searchAttempts = buildQihooSearchAttempts(seriesName, season, data.airDate, data.episodeName);

    for (const attempt of searchAttempts) {
      const response = await this.fetch.get(`${this.BASE_API}/index`, {
        params: {
          force_v: "1",
          kw: attempt.keyword,
          from: "",
          pageno: "1",
          v_ap: "1",
          tab: "all",
        },
        schema: qihooSearchResponseSchema,
      });
      if (!response.data?.length) continue;

      const episodeContext: QihooEpisodeMatchContext = {
        episodeName: data.episodeName,
        airDate: data.airDate,
        requireAirDate: Boolean(attempt.fallbackToken),
      };

      for (const item of response.data) {
        if (mediaType === MediaType.Movie && item.cat_id !== "1") {
          this.logger.warn("电影搜索结果中包含电视剧，跳过");
          continue;
        }
        if (mediaType === MediaType.TV && item.cat_id === "1") {
          this.logger.warn("电视剧搜索结果中包含电影，跳过");
          continue;
        }
        if (attempt.fallbackToken) {
          if (item.cat_id !== "3" || item.year !== attempt.year || !item.titleTxt.includes(attempt.fallbackToken)) {
            this.logger.warn("综艺改名候选缺少标题关键词或播出年份证据，跳过");
            continue;
          }
        } else {
          const exactNormalizedTitle =
            normalizeQihooSeriesTitle(item.titleTxt) === normalizeQihooSeriesTitle(seriesName);
          if (!exactNormalizedTitle && !item.titleTxt.includes(seriesName)) {
            this.logger.warn("搜索结果中包含的剧集标题与搜索关键词不匹配，跳过");
            continue;
          }
          if (
            !matchesQihooSeason(item.titleTxt, season) &&
            (!exactNormalizedTitle || (season !== undefined && season > 1))
          ) {
            this.logger.warn("搜索结果中的季数与请求不匹配，跳过");
            continue;
          }
        }
        if (!item.playlinks) {
          this.logger.warn("搜索结果中包含的剧集没有播放链接，跳过");
          continue;
        }

        const qqUrl = await this.selectVarietyUrl(item, "qq", episodeNumber, episodeContext);
        if (qqUrl) {
          const qqId = parseQihooTencentUrl(qqUrl);
          if (qqId) {
            results.push({
              provider: "tencent",
              idString: scraper.scraperMap.tencent.generateIdString(qqId),
              episodeNumber,
              episodeName: data.episodeName,
              airDate: data.airDate,
            });
          }
        }

        const youkuUrl = await this.selectVarietyUrl(item, "youku", episodeNumber, episodeContext);
        if (youkuUrl) {
          const youkuId = parseQihooYoukuUrl(youkuUrl);
          if (youkuId) {
            results.push({
              provider: "youku",
              idString: scraper.scraperMap.youku.generateIdString(youkuId),
              episodeNumber,
              episodeName: data.episodeName,
              airDate: data.airDate,
            });
          }
        }

        const iqiyiUrl = await this.selectVarietyUrl(item, "qiyi", episodeNumber, episodeContext);
        if (iqiyiUrl) {
          const videoId = iqiyiUrl.match(/\/v_([^/]+?)(\/|.html|$)/)?.[1];
          const entityId = videoId ? scraper.scraperMap.iqiyi.videoIdToEntityId(videoId) : undefined;
          if (entityId) {
            results.push({
              provider: "iqiyi",
              idString: scraper.scraperMap.iqiyi.generateIdString({ entityId, episodeId: entityId }),
              episodeNumber,
              episodeName: data.episodeName,
              airDate: data.airDate,
            });
          }
        }

        const bilibiliUrl = await this.selectVarietyUrl(item, "bilibili1", episodeNumber, episodeContext);
        if (bilibiliUrl) {
          const resp = await this.fetch.get<string>(bilibiliUrl, { cache: bilibiliUrl });
          const html = resp.data;
          const seasonId = html.match(/"season_id":(\d+)/)?.[1];
          if (seasonId) {
            results.push({
              provider: "bilibili",
              idString: scraper.scraperMap.bilibili.generateIdString({ seasonId }),
              episodeNumber,
              episodeName: data.episodeName,
              airDate: data.airDate,
            });
          }
        }

        const mgtvUrl = await this.selectVarietyUrl(item, "imgo", episodeNumber, episodeContext);
        if (mgtvUrl) {
          const mgtvId = parseQihooMgtvUrl(mgtvUrl);
          if (mgtvId) {
            results.push({
              provider: "mgtv",
              idString: scraper.scraperMap.mgtv.generateIdString(mgtvId),
              episodeNumber,
              episodeName: data.episodeName,
              airDate: data.airDate,
            });
          }
        }
      }
      if (results.length) return results;
    }

    return results;
  }
}
