import type { CanonicalMapping } from "./schema.ts";

export type MappingProviderEvidence = {
  provider: string;
  idString: string;
  episodeCount: number;
  season?: number;
  epRange?: readonly [number, number];
  epOffset?: number;
  episodeNumber?: number;
};

export type MappingTmdbEvidence = {
  tmdbId: number;
  type: "movie" | "tv";
  title: string;
};

export type MappingToolEvidence = {
  getTmdb: MappingTmdbEvidence[];
  listed: MappingProviderEvidence[];
  probed: MappingProviderEvidence[];
};

export type MappingToolDetail = {
  getTmdb?: MappingTmdbEvidence;
  listEpisodes?: MappingProviderEvidence;
  probe?: MappingProviderEvidence[];
};

export function createMappingToolEvidence(): MappingToolEvidence {
  return { getTmdb: [], listed: [], probed: [] };
}

export function recordMappingToolEvidence(evidence: MappingToolEvidence, detail?: MappingToolDetail): void {
  if (detail?.getTmdb) {
    evidence.getTmdb.push(detail.getTmdb);
  }
  if (detail?.listEpisodes && detail.listEpisodes.episodeCount > 0) {
    evidence.listed.push(detail.listEpisodes);
  }
  if (detail?.probe) {
    evidence.probed.push(...detail.probe.filter((item) => item.episodeCount > 0));
  }
}

function episodeRangesEqual(left?: readonly [number, number], right?: readonly [number, number]): boolean {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return left[0] === right[0] && left[1] === right[1];
}

function coversProvider(evidence: MappingProviderEvidence[], provider: CanonicalMapping["providers"][number]): boolean {
  return evidence.some((item) => {
    if (item.provider !== provider.provider || item.idString !== provider.idString || item.episodeCount <= 0) {
      return false;
    }
    if (!("season" in provider)) {
      return true;
    }
    if (item.season !== undefined || item.epRange !== undefined || item.epOffset !== undefined) {
      return (
        item.season === provider.season &&
        episodeRangesEqual(item.epRange, provider.epRange) &&
        (item.epOffset ?? 0) === provider.epOffset
      );
    }
    if (item.episodeNumber !== undefined) {
      if (!provider.epRange) {
        return true;
      }
      const tmdbEpisode = item.episodeNumber - provider.epOffset;
      return tmdbEpisode >= provider.epRange[0] && tmdbEpisode <= provider.epRange[1];
    }
    return provider.epRange === undefined;
  });
}

export function applyAuthoritativeTmdbTitle(
  mapping: CanonicalMapping,
  evidence: MappingToolEvidence,
): CanonicalMapping {
  const match = [...evidence.getTmdb]
    .reverse()
    .find((item) => item.tmdbId === mapping.tmdbId && item.type === mapping.type && item.title);
  if (!match) {
    return mapping;
  }
  return { ...mapping, title: match.title };
}

export function assertConfidentMappingEvidence(mapping: CanonicalMapping, evidence: MappingToolEvidence): void {
  if (!evidence.getTmdb.some((item) => item.tmdbId === mapping.tmdbId && item.type === mapping.type)) {
    throw new Error("get_tmdb is required before a confident submit");
  }
  const uncovered = mapping.providers.find(
    (provider) => !coversProvider(evidence.probed, provider) && !coversProvider(evidence.listed, provider),
  );
  if (uncovered) {
    throw new Error("probe_mapping or list_episodes is required before a confident submit");
  }
}
