import { describe, expect, test } from "@rstest/core";
import {
  applyAuthoritativeTmdbTitle,
  assertConfidentMappingEvidence,
  createMappingToolEvidence,
  recordMappingToolEvidence,
} from "./mapping-agent-evidence.ts";

const mapping = {
  type: "tv" as const,
  tmdbId: 282136,
  title: "将夜",
  providers: [{ season: 1, provider: "bilibili" as const, idString: "seasonId=45962", epOffset: 0 }],
};

describe("assertConfidentMappingEvidence", () => {
  test("requires get_tmdb for the submitted title", () => {
    const evidence = createMappingToolEvidence();
    recordMappingToolEvidence(evidence, { getTmdb: { tmdbId: 1, type: "tv", title: "Demo" } });
    recordMappingToolEvidence(evidence, {
      probe: [{ provider: "bilibili", idString: "seasonId=45962", episodeCount: 1 }],
    });
    expect(() => assertConfidentMappingEvidence(mapping, evidence)).toThrow(
      "get_tmdb is required before a confident submit",
    );
  });

  test("rejects probe evidence for a different idString", () => {
    const evidence = createMappingToolEvidence();
    recordMappingToolEvidence(evidence, { getTmdb: { tmdbId: 282136, type: "tv", title: "将夜" } });
    recordMappingToolEvidence(evidence, {
      probe: [{ provider: "bilibili", idString: "seasonId=1", episodeCount: 3 }],
    });
    expect(() => assertConfidentMappingEvidence(mapping, evidence)).toThrow(
      "probe_mapping or list_episodes is required before a confident submit",
    );
  });

  test("rejects empty episode lists", () => {
    const evidence = createMappingToolEvidence();
    recordMappingToolEvidence(evidence, { getTmdb: { tmdbId: 282136, type: "tv", title: "将夜" } });
    recordMappingToolEvidence(evidence, {
      listEpisodes: { provider: "bilibili", idString: "seasonId=45962", episodeCount: 0 },
    });
    expect(() => assertConfidentMappingEvidence(mapping, evidence)).toThrow(
      "probe_mapping or list_episodes is required before a confident submit",
    );
  });

  test("accepts matching nonempty probe evidence", () => {
    const evidence = createMappingToolEvidence();
    recordMappingToolEvidence(evidence, { getTmdb: { tmdbId: 282136, type: "tv", title: "将夜" } });
    recordMappingToolEvidence(evidence, {
      probe: [{ provider: "bilibili", idString: "seasonId=45962", episodeCount: 2 }],
    });
    expect(() => assertConfidentMappingEvidence(mapping, evidence)).not.toThrow();
  });

  test("overwrites a submitted title with the get_tmdb title", () => {
    const evidence = createMappingToolEvidence();
    recordMappingToolEvidence(evidence, { getTmdb: { tmdbId: 282136, type: "tv", title: "将夜" } });
    expect(applyAuthoritativeTmdbTitle({ ...mapping, title: "错的" }, evidence).title).toBe("将夜");
  });
});
