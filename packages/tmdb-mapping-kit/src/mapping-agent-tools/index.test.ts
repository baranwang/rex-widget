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
