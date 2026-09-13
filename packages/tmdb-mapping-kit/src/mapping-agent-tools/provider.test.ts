import { describe, expect, test } from "@rstest/core";
import { listEpisodesTool, makeIdStringTool, parseEpisodeTitleTool, parseIdStringTool } from "./provider.ts";

describe("idString tools", () => {
  test("parses a bilibili season idString", () => {
    expect(parseIdStringTool("bilibili", "seasonId=45962")).toEqual({ ok: true, id: { seasonId: "45962" } });
  });

  test("rejects an unknown provider", () => {
    expect(parseIdStringTool("netflix", "id=1")).toEqual({ ok: false, error: "unknown provider: netflix" });
  });

  test("builds a tencent series idString without vid", () => {
    expect(makeIdStringTool("tencent", { cid: "mzc00200a1b2c3d" })).toEqual({
      ok: true,
      idString: "cid=mzc00200a1b2c3d",
    });
  });
});

describe("parseEpisodeTitleTool", () => {
  test("parses a variety issue title", () => {
    expect(parseEpisodeTitleTool("第4期下：高空滑翔伞")).toEqual({
      episodeNumber: 4,
      part: "lower",
      edition: "main",
    });
  });
});

describe("listEpisodesTool", () => {
  test("lists a truncated episode page", async () => {
    const result = await listEpisodesTool(
      { provider: "bilibili", idString: "seasonId=1", episodeNumber: 1 },
      async () => [{ provider: "bilibili", episodeId: "seasonId=1", episodeTitle: "第1集", episodeNumber: 1 }],
    );
    expect(result).toEqual({
      ok: true,
      episodes: [{ provider: "bilibili", episodeId: "seasonId=1", episodeTitle: "第1集", episodeNumber: 1 }],
    });
  });
});
