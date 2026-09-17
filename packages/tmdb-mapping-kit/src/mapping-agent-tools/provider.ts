import {
  createScraperRegistry,
  generateProviderIdString,
  isProviderName,
  type ProviderEpisodeInfo,
  parseProviderIdStringFor,
  parseProviderUrl,
  parseVarietyEpisodeIdentity,
} from "@rexnow/scraper-kit";

const MAX_EPISODES = 40;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mapEpisode(episode: unknown): ProviderEpisodeInfo | undefined {
  if (!episode || typeof episode !== "object") {
    return undefined;
  }
  const record = episode as ProviderEpisodeInfo;
  if (
    typeof record.provider !== "string" ||
    typeof record.episodeId !== "string" ||
    typeof record.episodeTitle !== "string" ||
    typeof record.episodeNumber !== "number"
  ) {
    return undefined;
  }
  const mapped: ProviderEpisodeInfo = {
    provider: record.provider,
    episodeId: record.episodeId,
    episodeTitle: record.episodeTitle,
    episodeNumber: record.episodeNumber,
  };
  if (record.episodePart !== undefined) {
    mapped.episodePart = record.episodePart;
  }
  if (record.episodeEdition !== undefined) {
    mapped.episodeEdition = record.episodeEdition;
  }
  if (record.airDate !== undefined) {
    mapped.airDate = record.airDate;
  }
  return mapped;
}

export async function parseProviderUrlTool(url: string) {
  try {
    const parsed = await parseProviderUrl(url);
    if (!parsed) {
      return { ok: false as const, error: "could not parse provider URL" };
    }
    return { ok: true as const, provider: parsed.provider, idString: parsed.idString, id: parsed.id };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}

export function parseIdStringTool(provider: string, idString: string) {
  if (!isProviderName(provider)) {
    return { ok: false as const, error: `unknown provider: ${provider}` };
  }
  try {
    const id = parseProviderIdStringFor(provider, idString);
    return { ok: true as const, id };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}

export function makeIdStringTool(provider: string, id: Record<string, unknown>) {
  if (!isProviderName(provider)) {
    return { ok: false as const, error: `unknown provider: ${provider}` };
  }
  try {
    const idString = generateProviderIdString(provider, id);
    return { ok: true as const, idString };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}

export function parseEpisodeTitleTool(title: string) {
  return parseVarietyEpisodeIdentity(title);
}

export async function listEpisodesTool(
  input: {
    provider: string;
    idString: string;
    episodeNumber?: number;
    episodeName?: string;
    airDate?: string;
  },
  getEpisodes?: (
    idString: string,
    episodeNumber?: number,
    context?: { episodeName?: string; airDate?: string },
  ) => Promise<unknown[]>,
) {
  const { provider, idString, episodeNumber, episodeName, airDate } = input;
  if (!isProviderName(provider)) {
    return { ok: false as const, error: `unknown provider: ${provider}` };
  }
  try {
    const context = episodeName !== undefined || airDate !== undefined ? { episodeName, airDate } : undefined;
    const fetchEpisodes =
      getEpisodes ?? ((id, ep, ctx) => createScraperRegistry().scraperMap[provider].getEpisodes(id, ep, ctx));
    const rawEpisodes = await fetchEpisodes(idString, episodeNumber, context);
    const episodes = rawEpisodes
      .slice(0, MAX_EPISODES)
      .map((episode) => mapEpisode(episode))
      .filter((episode): episode is ProviderEpisodeInfo => episode !== undefined);
    return { ok: true as const, episodes };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}
