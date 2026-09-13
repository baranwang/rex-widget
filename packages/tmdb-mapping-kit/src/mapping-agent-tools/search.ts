import { createScraperRegistry, generateProviderIdString } from "@rexnow/scraper-kit";
import { platformsFrom360Rows, type SearchInput, type SearchOutput } from "./360kan-series.ts";
import { searchTmdb } from "./tmdb.ts";

const KAN360_INDEX_URL = "https://api.so.360kan.com/index";

function dedupePlatforms(platforms: SearchOutput["platforms"]): SearchOutput["platforms"] {
  const seen = new Set<string>();
  return platforms.filter((item) => {
    const key = `${item.provider}:${item.idString}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isProviderAllowed(provider: string, providers?: string[]): boolean {
  if (!providers?.length) {
    return true;
  }
  return providers.includes(provider);
}

async function fetch360Rows(query: string, fetchImpl: typeof fetch): Promise<unknown[]> {
  const params = new URLSearchParams({
    force_v: "1",
    kw: query,
    pageno: "1",
    v_ap: "1",
    tab: "all",
  });
  const response = await fetchImpl(`${KAN360_INDEX_URL}?${params.toString()}`);
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as {
    data?: { longData?: { rows?: unknown[] } | unknown[] };
  };
  const longData = payload.data?.longData;
  if (Array.isArray(longData)) {
    return [];
  }
  return Array.isArray(longData?.rows) ? longData.rows : [];
}

async function searchMgtvAndRenren(
  input: SearchInput,
  platforms: SearchOutput["platforms"],
): Promise<SearchOutput["platforms"]> {
  const scraperMap = createScraperRegistry().scraperMap;
  const searchParams = {
    seriesName: input.query,
    season: input.season,
    type: input.type,
  };

  if (isProviderAllowed("mgtv", input.providers) && scraperMap.mgtv.search) {
    try {
      const mgtvResults = await scraperMap.mgtv.search(searchParams);
      for (const item of mgtvResults) {
        platforms.push({
          provider: "mgtv",
          idString: generateProviderIdString("mgtv", { dramaId: item.dramaId }),
          source: "mgtv",
          title: item.dramaTitle,
        });
      }
    } catch {
      // keep 360kan results when mgtv search fails
    }
  }

  if (isProviderAllowed("renren", input.providers) && scraperMap.renren.search) {
    try {
      const renrenResults = await scraperMap.renren.search(searchParams);
      for (const item of renrenResults) {
        const dramaId = Number(item.dramaId);
        if (!Number.isFinite(dramaId)) {
          continue;
        }
        platforms.push({
          provider: "renren",
          idString: generateProviderIdString("renren", { dramaId }),
          source: "renren",
          title: item.dramaTitle,
        });
      }
    } catch {
      // keep other platform results when renren search fails
    }
  }

  return platforms;
}

async function searchPlatforms(
  input: SearchInput,
  _env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
): Promise<SearchOutput["platforms"]> {
  const rows = await fetch360Rows(input.query, fetchImpl);
  let platforms = platformsFrom360Rows(rows, input);
  platforms = await searchMgtvAndRenren(input, platforms);
  const limit = input.limit ?? 12;
  return dedupePlatforms(platforms).slice(0, limit);
}

export async function searchCatalog(
  input: SearchInput,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<SearchOutput> {
  const scope = input.scope ?? "all";
  const tmdbTask = scope === "platforms" ? Promise.resolve([]) : searchTmdb(input, env, fetchImpl).catch(() => []);
  const platformTask = scope === "tmdb" ? Promise.resolve([]) : searchPlatforms(input, env, fetchImpl).catch(() => []);
  const [tmdb, platforms] = await Promise.all([tmdbTask, platformTask]);
  return { tmdb, platforms };
}

export type { SearchInput, SearchOutput, SearchScope } from "./360kan-series.ts";
