import fs from "node:fs";
import path from "node:path";
import { mappingDataRelativePath, mergeMappingFile } from "../mapping-agent.ts";
import type { CanonicalMapping } from "../schema.ts";
import { canonicalMappingSchema } from "../schema.ts";
import { listEpisodesTool } from "./provider.ts";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mappingDataPath(repoRoot: string, input: Pick<CanonicalMapping, "type" | "tmdbId">): string {
  return path.join(repoRoot, mappingDataRelativePath(input));
}

function episodeInRange(episode: number, epRange?: readonly [number, number]): boolean {
  if (!epRange) {
    return true;
  }
  return episode >= epRange[0] && episode <= epRange[1];
}

function resolveProviderEpisode(provider: CanonicalMapping["providers"][number], sampleEpisode?: number): number {
  const epRange = "epRange" in provider ? provider.epRange : undefined;
  if (sampleEpisode !== undefined && episodeInRange(sampleEpisode, epRange)) {
    return sampleEpisode;
  }
  if (epRange) {
    return epRange[0];
  }
  return 1;
}

export function listExistingMapping(repoRoot: string, input: { type: "movie" | "tv"; tmdbId: number }) {
  const dataPath = mappingDataPath(repoRoot, input);
  if (!fs.existsSync(dataPath)) {
    return { ok: true as const, mapping: null };
  }
  try {
    const parsed = canonicalMappingSchema.safeParse(JSON.parse(fs.readFileSync(dataPath, "utf8")));
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error.message };
    }
    return { ok: true as const, mapping: parsed.data };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}

export function previewMerge(repoRoot: string, incoming: CanonicalMapping) {
  const existing = listExistingMapping(repoRoot, { type: incoming.type, tmdbId: incoming.tmdbId });
  if (!existing.ok) {
    return { ok: false as const, error: existing.error };
  }
  try {
    const result = mergeMappingFile(existing.mapping, incoming);
    return { ok: true as const, changed: result.changed, mapping: result.mapping };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}

type ProbeRouting = {
  season?: number;
  epRange?: readonly [number, number];
  epOffset?: number;
};

type ProbeResult = (
  | { provider: string; idString: string; ok: true; episodes: Awaited<ReturnType<typeof listEpisodesTool>>["episodes"] }
  | { provider: string; idString: string; ok: false; error: string }
) &
  ProbeRouting;

function routingFromProvider(provider: CanonicalMapping["providers"][number]): ProbeRouting {
  if (!("season" in provider)) {
    return {};
  }
  return {
    season: provider.season,
    epOffset: provider.epOffset,
    ...(provider.epRange ? { epRange: provider.epRange } : {}),
  };
}

export async function probeMapping(
  _repoRoot: string,
  mapping: CanonicalMapping,
  sampleEpisode?: number,
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  if (mapping.type === "movie") {
    for (const provider of mapping.providers) {
      const result = await listEpisodesTool({ provider: provider.provider, idString: provider.idString });
      if (result.ok) {
        results.push({
          provider: provider.provider,
          idString: provider.idString,
          ok: true,
          episodes: result.episodes,
          ...routingFromProvider(provider),
        });
      } else {
        results.push({
          provider: provider.provider,
          idString: provider.idString,
          ok: false,
          error: result.error,
          ...routingFromProvider(provider),
        });
      }
    }
    return results;
  }

  for (const provider of mapping.providers) {
    const episode = resolveProviderEpisode(provider, sampleEpisode);
    const result = await listEpisodesTool({
      provider: provider.provider,
      idString: provider.idString,
      episodeNumber: episode + provider.epOffset,
    });
    if (result.ok) {
      results.push({
        provider: provider.provider,
        idString: provider.idString,
        ok: true,
        episodes: result.episodes,
        ...routingFromProvider(provider),
      });
    } else {
      results.push({
        provider: provider.provider,
        idString: provider.idString,
        ok: false,
        error: result.error,
        ...routingFromProvider(provider),
      });
    }
  }
  return results;
}
