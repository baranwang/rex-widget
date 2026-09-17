import { generateProviderIdString, parseProviderUrl, parseVarietyEpisodeIdentity } from "@rexnow/scraper-kit";
import type { SearchInput, SearchOutput } from "./types.ts";

type PlatformHit = SearchOutput["platforms"][number];

const PLATFORM_LIMIT_DEFAULT = 12;

const SITE_PROVIDER_MAP: Record<string, string> = {
  qq: "tencent",
  youku: "youku",
  qiyi: "iqiyi",
  bilibili1: "bilibili",
  imgo: "mgtv",
};

export const parseQihooTencentUrl = (url: string) => {
  const urlObj = new URL(url);
  const withVidMatch = urlObj.pathname.match(/^\/x\/cover\/([^/]+)\/([^/.]+)\.html$/);
  if (withVidMatch) {
    return { cid: withVidMatch[1], vid: withVidMatch[2] };
  }

  const cidOnlyMatch = urlObj.pathname.match(/^\/x\/cover\/([^/.]+)\.html$/);
  if (cidOnlyMatch) {
    return { cid: cidOnlyMatch[1] };
  }

  const cid = urlObj.searchParams.get("cid");
  const vid = urlObj.searchParams.get("vid");
  return cid ? { cid, ...(vid ? { vid } : {}) } : null;
};

export const parseQihooYoukuUrl = (url: string) => {
  const urlObj = new URL(url);
  const showId = urlObj.searchParams.get("showid") || urlObj.searchParams.get("showId") || urlObj.searchParams.get("s");
  const vid = urlObj.searchParams.get("vid") || urlObj.pathname.match(/^\/v_show\/id_(.+)\.html$/)?.[1];
  return showId || vid ? { ...(showId ? { showId } : {}), ...(vid ? { vid } : {}) } : null;
};

export const parseQihooMgtvUrl = (url: string) => {
  const urlObj = new URL(url);
  const videoMatch = urlObj.pathname.match(/^\/b\/([^/]+)\/([^/.]+)\.html$/);
  if (videoMatch) {
    return { dramaId: videoMatch[1], videoId: videoMatch[2] };
  }
  const dramaMatch = urlObj.pathname.match(/^\/h\/([^/.]+)\.html$/);
  return dramaMatch ? { dramaId: dramaMatch[1] } : null;
};

export const matchesQihooSeason = (title: string, season?: number) => {
  if (season === undefined) return true;
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

function matchesTitle(titleTxt: string, query: string): boolean {
  if (normalizeQihooSeriesTitle(titleTxt) === normalizeQihooSeriesTitle(query)) {
    return true;
  }
  return titleTxt.replace(/\s/g, "").includes(query.replace(/\s/g, ""));
}

function matchesMediaType(catId: string, type?: "movie" | "tv"): boolean {
  if (!type) {
    return true;
  }
  if (type === "movie") {
    return catId === "1";
  }
  return catId === "2" || catId === "3";
}

function isProviderAllowed(provider: string, providers?: string[]): boolean {
  if (!providers?.length) {
    return true;
  }
  return providers.includes(provider);
}

function parseRow(row: unknown): { cat_id: string; titleTxt: string; playlinks: Record<string, string> } | undefined {
  if (!row || typeof row !== "object") {
    return undefined;
  }
  const record = row as Record<string, unknown>;
  const cat_id = typeof record.cat_id === "string" ? record.cat_id : undefined;
  const titleTxt = typeof record.titleTxt === "string" ? record.titleTxt : undefined;
  if (!cat_id || !titleTxt) {
    return undefined;
  }
  const rawPlaylinks = record.playlinks;
  if (!rawPlaylinks || typeof rawPlaylinks !== "object") {
    return undefined;
  }
  const playlinks: Record<string, string> = {};
  for (const [site, value] of Object.entries(rawPlaylinks)) {
    if (typeof value === "string") {
      playlinks[site] = value;
    }
  }
  return { cat_id, titleTxt, playlinks };
}

async function parseSitePlaylink(site: string, url: string): Promise<PlatformHit | undefined> {
  try {
    const provider = SITE_PROVIDER_MAP[site];
    if (!provider) {
      return undefined;
    }

    if (site === "qq") {
      const qqId = parseQihooTencentUrl(url);
      if (!qqId?.cid) {
        return undefined;
      }
      return {
        provider,
        idString: generateProviderIdString("tencent", { cid: qqId.cid }),
        source: "360kan",
      };
    }

    if (site === "youku") {
      const youkuId = parseQihooYoukuUrl(url);
      if (!youkuId?.showId) {
        return undefined;
      }
      return {
        provider,
        idString: generateProviderIdString("youku", { showId: youkuId.showId }),
        source: "360kan",
      };
    }

    if (site === "imgo") {
      const mgtvId = parseQihooMgtvUrl(url);
      if (!mgtvId?.dramaId) {
        return undefined;
      }
      return {
        provider,
        idString: generateProviderIdString("mgtv", { dramaId: mgtvId.dramaId }),
        source: "360kan",
      };
    }

    if (site === "bilibili1") {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return undefined;
      }
      if (/^\/bangumi\/play\/ep\d+/.test(parsedUrl.pathname)) {
        return undefined;
      }
      const parsed = await parseProviderUrl(url);
      const seasonId =
        parsed?.provider === "bilibili" && parsed.id && "seasonId" in parsed.id ? parsed.id.seasonId : undefined;
      if (!seasonId) {
        return undefined;
      }
      return {
        provider,
        idString: generateProviderIdString("bilibili", { seasonId }),
        source: "360kan",
      };
    }

    if (site === "qiyi") {
      const parsed = await parseProviderUrl(url);
      const entityId =
        parsed?.provider === "iqiyi" && parsed.id && "entityId" in parsed.id ? parsed.id.entityId : undefined;
      if (!entityId) {
        return undefined;
      }
      return {
        provider,
        idString: generateProviderIdString("iqiyi", { entityId }),
        source: "360kan",
      };
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export async function platformsFrom360Rows(rows: unknown[], input: SearchInput): Promise<SearchOutput["platforms"]> {
  const limit = input.limit ?? PLATFORM_LIMIT_DEFAULT;
  const seen = new Set<string>();
  const platforms: SearchOutput["platforms"] = [];

  for (const row of rows) {
    const parsed = parseRow(row);
    if (!parsed) {
      continue;
    }
    if (!matchesMediaType(parsed.cat_id, input.type)) {
      continue;
    }
    if (!matchesTitle(parsed.titleTxt, input.query)) {
      continue;
    }
    if (!matchesQihooSeason(parsed.titleTxt, input.season)) {
      continue;
    }

    for (const [site, url] of Object.entries(parsed.playlinks)) {
      const hit = await parseSitePlaylink(site, url);
      if (!hit) {
        continue;
      }
      if (!isProviderAllowed(hit.provider, input.providers)) {
        continue;
      }
      const dedupeKey = `${hit.provider}:${hit.idString}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      platforms.push({ ...hit, title: parsed.titleTxt });
      if (platforms.length >= limit) {
        return platforms;
      }
    }
  }

  return platforms;
}
