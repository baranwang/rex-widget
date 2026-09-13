import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, rs, test } from "@rstest/core";
import { mappingDataRelativePath } from "../mapping-agent.ts";
import type { CanonicalMapping } from "../schema.ts";
import { listExistingMapping, previewMerge, probeMapping } from "./mapping-inspect.ts";

const existingMapping: CanonicalMapping = {
  type: "tv",
  tmdbId: 282136,
  title: "将夜",
  providers: [{ season: 1, provider: "bilibili", idString: "seasonId=45962", epOffset: 0 }],
};

function withTempRepo(mapping: CanonicalMapping, fn: (repoRoot: string) => void | Promise<void>) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mapping-inspect-"));
  const dataPath = path.join(repoRoot, mappingDataRelativePath(mapping));
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, `${JSON.stringify(mapping, null, 2)}\n`);
  return fn(repoRoot);
}

rs.mock("./provider.ts", () => ({
  listEpisodesTool: rs.fn(),
}));

describe("mapping inspect helpers", () => {
  test("listExistingMapping returns the on-disk mapping", () => {
    withTempRepo(existingMapping, (repoRoot) => {
      const result = listExistingMapping(repoRoot, { type: "tv", tmdbId: 282136 });
      expect(result).toEqual({ ok: true, mapping: existingMapping });
    });
  });

  test("previewMerge reports no change for the same provider", () => {
    withTempRepo(existingMapping, (repoRoot) => {
      const result = previewMerge(repoRoot, existingMapping);
      expect(result).toEqual({ ok: true, changed: false, mapping: existingMapping });
    });
  });

  test("previewMerge reports a change for a second provider", () => {
    withTempRepo(existingMapping, (repoRoot) => {
      const incoming: CanonicalMapping = {
        ...existingMapping,
        providers: [
          ...existingMapping.providers,
          { season: 1, provider: "tencent", idString: "cid=mzc00200a1b2c3d", epOffset: 0 },
        ],
      };
      const result = previewMerge(repoRoot, incoming);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.changed).toBe(true);
      }
    });
  });

  test("probeMapping records ok for episode 1 with a stubbed listEpisodesTool", async () => {
    const { listEpisodesTool } = await import("./provider.ts");
    const mockedListEpisodes = rs.mocked(listEpisodesTool);
    mockedListEpisodes.mockResolvedValueOnce({
      ok: true,
      episodes: [{ provider: "bilibili", episodeId: "seasonId=45962", episodeTitle: "第1集", episodeNumber: 1 }],
    });

    const results = await probeMapping("/tmp/unused", existingMapping);
    expect(results).toEqual([
      {
        provider: "bilibili",
        idString: "seasonId=45962",
        ok: true,
        episodes: [{ provider: "bilibili", episodeId: "seasonId=45962", episodeTitle: "第1集", episodeNumber: 1 }],
      },
    ]);
    expect(mockedListEpisodes).toHaveBeenCalledWith({
      provider: "bilibili",
      idString: "seasonId=45962",
      episodeNumber: 1,
    });
  });
});
