import { describe, expect, test } from "@rstest/core";
import { createMappingTools, mappingAgentToolNames } from "./index.ts";

describe("mappingAgentToolNames", () => {
  test("includes official read-only tools and excludes write tools", () => {
    expect(mappingAgentToolNames).toContain("bash");
    expect(mappingAgentToolNames).not.toContain("write");
    expect(mappingAgentToolNames).not.toContain("edit");
  });

  test("matches the expected allowlist", () => {
    expect(mappingAgentToolNames).toEqual([
      "bash",
      "read",
      "grep",
      "find",
      "ls",
      "search",
      "get_tmdb",
      "parse_provider_url",
      "parse_id_string",
      "make_id_string",
      "parse_episode_title",
      "list_episodes",
      "list_existing_mapping",
      "preview_merge",
      "probe_mapping",
      "submit_mapping",
    ]);
  });
});

describe("createMappingTools", () => {
  test("returns custom tools with name and execute", () => {
    const tools = createMappingTools({
      env: {},
      repoRoot: "/tmp",
      onTool: () => {},
      onSubmit: () => {},
    });
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(typeof tool.execute).toBe("function");
    }
    expect(tools.map((tool) => tool.name)).toEqual([
      "search",
      "get_tmdb",
      "parse_provider_url",
      "parse_id_string",
      "make_id_string",
      "parse_episode_title",
      "list_episodes",
      "list_existing_mapping",
      "preview_merge",
      "probe_mapping",
      "submit_mapping",
    ]);
  });

  test("calls onTool when a tool executes", async () => {
    const calls: string[] = [];
    const tools = createMappingTools({
      env: {},
      repoRoot: "/tmp",
      onTool: (name) => calls.push(name),
      onSubmit: () => {},
    });
    const parseEpisodeTitle = tools.find((tool) => tool.name === "parse_episode_title");
    await parseEpisodeTitle?.execute("1", { title: "第4期下" });
    expect(calls).toEqual(["parse_episode_title"]);
  });

  test("does not record get_tmdb when getTmdb throws", async () => {
    const calls: string[] = [];
    const tools = createMappingTools({
      env: {},
      repoRoot: "/tmp",
      onTool: (name) => calls.push(name),
      onSubmit: () => {},
    });
    const getTmdbTool = tools.find((tool) => tool.name === "get_tmdb");
    await expect(getTmdbTool?.execute("1", { tmdbId: 1, type: "movie" })).rejects.toThrow(
      "TMDB_ACCESS_TOKEN is required",
    );
    expect(calls).toEqual([]);
  });

  test("does not record list_episodes when the result is not ok", async () => {
    const calls: string[] = [];
    const tools = createMappingTools({
      env: {},
      repoRoot: "/tmp",
      onTool: (name) => calls.push(name),
      onSubmit: () => {},
    });
    const listEpisodes = tools.find((tool) => tool.name === "list_episodes");
    await listEpisodes?.execute("1", { provider: "unknown", idString: "x" });
    expect(calls).toEqual([]);
  });

  test("does not record probe_mapping when every probe item fails", async () => {
    const calls: string[] = [];
    const tools = createMappingTools({
      env: {},
      repoRoot: "/tmp",
      onTool: (name) => calls.push(name),
      onSubmit: () => {},
    });
    const probeMappingTool = tools.find((tool) => tool.name === "probe_mapping");
    await probeMappingTool?.execute("1", {
      mapping: {
        type: "movie",
        tmdbId: 1,
        title: "Demo",
        providers: [{ provider: "unknown", idString: "x" }],
      },
    });
    expect(calls).toEqual([]);
  });

  test("does not record probe_mapping when the mapping fails schema", async () => {
    const calls: string[] = [];
    const tools = createMappingTools({
      env: {},
      repoRoot: "/tmp",
      onTool: (name) => calls.push(name),
      onSubmit: () => {},
    });
    const probeMappingTool = tools.find((tool) => tool.name === "probe_mapping");
    const result = await probeMappingTool?.execute("1", {
      mapping: {
        type: "tv",
        tmdbId: 1,
        title: "Demo",
        providers: [{ provider: "bilibili", idString: "seasonId=1", epOffset: 0 }],
      },
    });
    expect(calls).toEqual([]);
    expect(result).toMatchObject({ details: { ok: false } });
  });

  test("submit_mapping calls onSubmit and terminates", async () => {
    let submitted: unknown;
    const tools = createMappingTools({
      env: {},
      repoRoot: "/tmp",
      onTool: () => {},
      onSubmit: (value) => {
        submitted = value;
      },
    });
    const submitMapping = tools.find((tool) => tool.name === "submit_mapping");
    const result = await submitMapping?.execute("1", { status: "ambiguous", reason: "unclear season" });
    expect(submitted).toEqual({ status: "ambiguous", reason: "unclear season" });
    expect(result).toEqual({
      content: [{ type: "text", text: "submitted" }],
      details: { status: "ambiguous", reason: "unclear season" },
      terminate: true,
    });
  });
});
