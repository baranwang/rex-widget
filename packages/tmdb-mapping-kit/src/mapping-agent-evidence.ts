import type { CanonicalMapping } from "./schema.ts";

export type MappingProviderEvidence = {
  provider: string;
  idString: string;
  episodeCount: number;
};

export type MappingToolEvidence = {
  getTmdb: Array<{ tmdbId: number; type: "movie" | "tv" }>;
  listed: MappingProviderEvidence[];
  probed: MappingProviderEvidence[];
};

export type MappingToolDetail = {
  getTmdb?: { tmdbId: number; type: "movie" | "tv" };
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

function coversProvider(
  evidence: MappingProviderEvidence[],
  provider: { provider: string; idString: string },
): boolean {
  return evidence.some(
    (item) => item.provider === provider.provider && item.idString === provider.idString && item.episodeCount > 0,
  );
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
