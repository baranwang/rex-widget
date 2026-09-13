export type TmdbHit = {
  tmdbId: number;
  type: "movie" | "tv";
  title: string;
  year?: number;
  url: string;
};

export type TmdbDetails = TmdbHit & {
  overview?: string;
  seasonEpisodes?: Array<{ episodeNumber: number; name: string; airDate?: string }>;
};

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_SITE_BASE = "https://www.themoviedb.org";

function requiredToken(env: NodeJS.ProcessEnv): string {
  const token = env.TMDB_ACCESS_TOKEN;
  if (!token) {
    throw new Error("TMDB_ACCESS_TOKEN is required");
  }
  return token;
}

function language(env: NodeJS.ProcessEnv): string {
  return env.TMDB_LANGUAGE || "zh-CN";
}

function parseYear(dateValue: unknown): number | undefined {
  return typeof dateValue === "string" && /^\d{4}/.test(dateValue) ? Number(dateValue.slice(0, 4)) : undefined;
}

function tmdbUrl(type: "movie" | "tv", tmdbId: number): string {
  return `${TMDB_SITE_BASE}/${type}/${tmdbId}`;
}

async function tmdbFetch(url: string, env: NodeJS.ProcessEnv, fetchImpl: typeof fetch): Promise<Response> {
  return fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${requiredToken(env)}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(120_000),
  });
}

function movieTitle(data: Record<string, unknown>): string | undefined {
  return (
    (typeof data.title === "string" && data.title) ||
    (typeof data.original_title === "string" && data.original_title) ||
    undefined
  );
}

function tvTitle(data: Record<string, unknown>): string | undefined {
  return (
    (typeof data.name === "string" && data.name) ||
    (typeof data.original_name === "string" && data.original_name) ||
    undefined
  );
}

function mapSearchResult(result: Record<string, unknown>, type: "movie" | "tv"): TmdbHit | undefined {
  const tmdbId = typeof result.id === "number" ? result.id : undefined;
  if (tmdbId === undefined) {
    return undefined;
  }
  const title = type === "movie" ? movieTitle(result) : tvTitle(result);
  if (!title) {
    return undefined;
  }
  const dateValue = type === "movie" ? result.release_date : result.first_air_date;
  return {
    tmdbId,
    type,
    title,
    year: parseYear(dateValue),
    url: tmdbUrl(type, tmdbId),
  };
}

export async function getTmdb(
  input: { tmdbId: number; type: "movie" | "tv"; season?: number },
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<TmdbDetails> {
  const lang = language(env);
  const detailsUrl = `${TMDB_API_BASE}/${input.type}/${input.tmdbId}?language=${encodeURIComponent(lang)}`;
  const response = await tmdbFetch(detailsUrl, env, fetchImpl);
  if (!response.ok) {
    throw new Error(`TMDB fetch failed (${response.status})`);
  }
  const data = (await response.json()) as Record<string, unknown>;
  const title = input.type === "movie" ? movieTitle(data) : tvTitle(data);
  if (!title) {
    throw new Error("TMDB response missing title");
  }
  const dateValue = input.type === "movie" ? data.release_date : data.first_air_date;
  const details: TmdbDetails = {
    tmdbId: input.tmdbId,
    type: input.type,
    title,
    year: parseYear(dateValue),
    url: tmdbUrl(input.type, input.tmdbId),
  };
  if (typeof data.overview === "string" && data.overview) {
    details.overview = data.overview;
  }
  if (input.type === "tv" && input.season !== undefined) {
    const seasonUrl = `${TMDB_API_BASE}/tv/${input.tmdbId}/season/${input.season}?language=${encodeURIComponent(lang)}`;
    const seasonResponse = await tmdbFetch(seasonUrl, env, fetchImpl);
    if (!seasonResponse.ok) {
      throw new Error(`TMDB season fetch failed (${seasonResponse.status})`);
    }
    const seasonData = (await seasonResponse.json()) as Record<string, unknown>;
    const episodes = Array.isArray(seasonData.episodes) ? seasonData.episodes : [];
    details.seasonEpisodes = episodes
      .map((episode) => {
        if (!episode || typeof episode !== "object") {
          return undefined;
        }
        const record = episode as Record<string, unknown>;
        const episodeNumber = typeof record.episode_number === "number" ? record.episode_number : undefined;
        const name = typeof record.name === "string" ? record.name : undefined;
        if (episodeNumber === undefined || !name) {
          return undefined;
        }
        const entry: { episodeNumber: number; name: string; airDate?: string } = { episodeNumber, name };
        if (typeof record.air_date === "string" && record.air_date) {
          entry.airDate = record.air_date;
        }
        return entry;
      })
      .filter((entry): entry is { episodeNumber: number; name: string; airDate?: string } => entry !== undefined);
  }
  return details;
}

async function searchTmdbType(
  query: string,
  type: "movie" | "tv",
  year: number | undefined,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
): Promise<TmdbHit[]> {
  const params = new URLSearchParams({
    query,
    language: language(env),
    include_adult: "false",
  });
  if (year !== undefined) {
    params.set("year", String(year));
    if (type === "tv") {
      params.set("first_air_date_year", String(year));
    }
  }
  const url = `${TMDB_API_BASE}/search/${type}?${params.toString()}`;
  const response = await tmdbFetch(url, env, fetchImpl);
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as Record<string, unknown>;
  const results = Array.isArray(data.results) ? data.results : [];
  return results
    .map((result) =>
      result && typeof result === "object" ? mapSearchResult(result as Record<string, unknown>, type) : undefined,
    )
    .filter((hit): hit is TmdbHit => hit !== undefined);
}

export async function searchTmdb(
  input: { query: string; type?: "movie" | "tv"; year?: number; limit?: number },
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<TmdbHit[]> {
  const limit = input.limit ?? 8;
  const types: Array<"movie" | "tv"> = input.type ? [input.type] : ["movie", "tv"];
  const hits: TmdbHit[] = [];
  for (const type of types) {
    const results = await searchTmdbType(input.query, type, input.year, env, fetchImpl);
    hits.push(...results);
    if (hits.length >= limit) {
      break;
    }
  }
  return hits.slice(0, limit);
}
