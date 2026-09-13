import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, rs, test } from "@rstest/core";
import {
  createChangesetContent,
  createMappingFileContent,
  defaultRepoRoot,
  fetchTmdbMetadata,
  type IssueFormFields,
  mappingDataRelativePath,
  mergeMappingFile,
  modelSelection,
  parseCliArgs,
  parseMappingAgentArgs,
  runMappingAgent,
  runMappingAgentCli,
  writeMappingAgentSummary,
  writeMappingArtifacts,
} from "./mapping-agent.ts";
import type { MappingSessionFactory } from "./mapping-agent-session.ts";

rs.mock("./mapping-agent-tools/provider.ts", () => ({
  listEpisodesTool: rs.fn(async () => ({
    ok: true,
    episodes: [{ episodeNumber: 1, episodeName: "e1" }],
  })),
}));

type CustomTools = Parameters<MappingSessionFactory>[0]["customTools"];

const jiangyeMapping = {
  type: "tv" as const,
  tmdbId: 282136,
  title: "将夜",
  providers: [{ season: 1, provider: "bilibili" as const, idString: "seasonId=45962", epOffset: 0 }],
};

beforeEach(async () => {
  const { listEpisodesTool } = await import("./mapping-agent-tools/provider.ts");
  rs.mocked(listEpisodesTool).mockReset();
  rs.mocked(listEpisodesTool).mockResolvedValue({
    ok: true,
    episodes: [{ episodeNumber: 1, episodeName: "e1" }],
  });
});

const sessionEnv = {
  PI_API_KEY: "test-api-key",
  PI_MODEL: "custom/model-a",
  TMDB_ACCESS_TOKEN: "tmdb-token",
};

function requireTool(customTools: CustomTools, name: string) {
  const tool = customTools.find((item) => item.name === name);
  if (!tool) {
    throw new Error(`missing tool ${name}`);
  }
  return tool;
}

function createFakeSession(run: (customTools: CustomTools) => Promise<void>): MappingSessionFactory {
  return async ({ customTools }) => ({
    session: {
      subscribe: () => () => {},
      prompt: async () => {
        await run(customTools);
      },
      abort: async () => {},
      dispose: () => {},
    },
  });
}

async function withMockedFetch<T>(fetchImpl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function executeLoggedSubmit(
  customTools: CustomTools,
  mapping: {
    type: "movie" | "tv";
    tmdbId: number;
    title: string;
    providers: Array<Record<string, unknown>>;
  },
  extra?: (customTools: CustomTools) => Promise<void>,
) {
  if (extra) {
    await extra(customTools);
  }
  await requireTool(customTools, "get_tmdb").execute("get-tmdb", {
    tmdbId: mapping.tmdbId,
    type: mapping.type,
  });
  await requireTool(customTools, "probe_mapping").execute("probe", { mapping });
  await requireTool(customTools, "submit_mapping").execute("submit", {
    status: "confident",
    mapping,
  });
}

describe("mapping agent CLI and provider config parsing", () => {
  test("requires issue, issue-body-file, and summary-file", () => {
    expect(parseCliArgs(["--issue", "42", "--issue-body-file", "./body.md", "--summary-file", "./summary.json"])).toBe(
      42,
    );
    expect(
      parseMappingAgentArgs(["--issue", "42", "--issue-body-file", "./body.md", "--summary-file", "./summary.json"]),
    ).toEqual({
      issue: 42,
      issueBodyFile: "./body.md",
      summaryFile: "./summary.json",
    });
    expect(() => parseCliArgs([])).toThrow("usage: tmdb:mapping-agent");
    expect(() => parseCliArgs(["--issue", "0"])).toThrow("usage: tmdb:mapping-agent");
    expect(() => parseMappingAgentArgs(["--issue", "42", "--summary-file", "./summary.json"])).toThrow(
      "usage: tmdb:mapping-agent",
    );
    expect(() => parseMappingAgentArgs(["--issue", "42", "--issue-body-file", "./body.md"])).toThrow(
      "usage: tmdb:mapping-agent",
    );
    expect(() =>
      parseMappingAgentArgs(["--issue", "42", "--issue-body-file", "   ", "--summary-file", "./summary.json"]),
    ).toThrow("usage: tmdb:mapping-agent");
    expect(() =>
      parseMappingAgentArgs(["--issue", "42", "--issue-body-file", "./body.md", "--summary-file", "   "]),
    ).toThrow("usage: tmdb:mapping-agent");
    expect(() => parseMappingAgentArgs(["--issue", "42", "--issue-body-file", "./body.md", "--summary-file"])).toThrow(
      "usage: tmdb:mapping-agent",
    );
  });

  test("parses generic OpenCode provider and model config without provider secrets", () => {
    expect(modelSelection({ OPENCODE_MODEL: "custom/model-a" })).toEqual({
      providerID: "custom",
      modelID: "model-a",
    });
    expect(modelSelection({ OPENCODE_PROVIDER: "custom", OPENCODE_MODEL: "model-a" })).toEqual({
      providerID: "custom",
      modelID: "model-a",
    });
  });
});

describe("issue template has no id: media_type", () => {
  test("keeps the issue template free of media type input", () => {
    const template = fs.readFileSync(
      path.resolve(process.cwd(), "..", "..", ".github/ISSUE_TEMPLATE/tmdb-platform-mapping.yml"),
      "utf8",
    );
    expect(template).not.toContain("id: media_type");
    expect(template).toContain("id: media_title");
    expect(template).toMatch(/id: media_title[\s\S]*?required: false/);
  });
});

describe("TMDB metadata fetch", () => {
  const movieFields: IssueFormFields = {
    media_title: "Issue Title",
    media_type: "movie",
    tmdb_url: "https://www.themoviedb.org/movie/980477",
    platform_urls: ["https://v.qq.com/x/cover/demo.html"],
    notes: "",
  };

  const tvFields: IssueFormFields = {
    media_title: "Issue Title",
    media_type: "tv",
    tmdb_url: "https://www.themoviedb.org/tv/12345",
    platform_urls: ["https://v.qq.com/x/cover/demo.html"],
    notes: "",
  };

  function response(json: Record<string, unknown>, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => json,
    } as Response;
  }

  test("fetches movie title and year from TMDB metadata", async () => {
    const fetchImpl: typeof fetch = async (_input, init) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return response({ title: "TMDB Movie", release_date: "2025-03-01" });
    };

    await withMockedFetch(fetchImpl, async () => {
      await expect(fetchTmdbMetadata(movieFields, { TMDB_ACCESS_TOKEN: "token" })).resolves.toEqual({
        title: "TMDB Movie",
        year: 2025,
      });
    });
  });

  test("fetches TV title and year from TMDB metadata", async () => {
    const fetchImpl = async () => response({ name: "TMDB Show", first_air_date: "2024-11-09" });

    await withMockedFetch(fetchImpl, async () => {
      await expect(fetchTmdbMetadata(tvFields, { TMDB_ACCESS_TOKEN: "token" })).resolves.toEqual({
        title: "TMDB Show",
        year: 2024,
      });
    });
  });

  test("requires a TMDB access token", async () => {
    const fetchImpl = async () => response({ title: "TMDB Movie" });

    await withMockedFetch(fetchImpl, async () => {
      await expect(fetchTmdbMetadata(movieFields, {})).rejects.toThrow("TMDB_ACCESS_TOKEN is required");
    });
  });

  test("fails on non-2xx TMDB metadata responses", async () => {
    const fetchImpl = async () => response({}, 503);

    await withMockedFetch(fetchImpl, async () => {
      await expect(fetchTmdbMetadata(movieFields, { TMDB_ACCESS_TOKEN: "token" })).rejects.toThrow(
        "TMDB metadata fetch failed with status 503",
      );
    });
  });

  test("fails when TMDB metadata omits a usable title", async () => {
    const fetchImpl = async () => response({ release_date: "2025-03-01" });

    await withMockedFetch(fetchImpl, async () => {
      await expect(fetchTmdbMetadata(movieFields, { TMDB_ACCESS_TOKEN: "token" })).rejects.toThrow(
        "TMDB metadata response did not include a title",
      );
    });
  });
});

describe("write safety helpers", () => {
  const mapping = {
    type: "movie" as const,
    tmdbId: 980477,
    title: "Ne Zha 2",
    providers: [{ provider: "iqiyi" as const, idString: "abc" }],
  };

  test("creates stable JSON file content without source metadata", () => {
    expect(createMappingFileContent(mapping)).toBe(`${JSON.stringify(mapping, null, 2)}\n`);
  });

  test("merges exact duplicate provider entries as a no-op", () => {
    const existing = {
      type: "tv" as const,
      tmdbId: 95479,
      title: "Jujutsu Kaisen",
      providers: [{ season: 1, provider: "bilibili" as const, idString: "seasonId=34430", epOffset: 0 }],
    };

    expect(mergeMappingFile(existing, existing)).toEqual({ mapping: existing, changed: false });
  });

  test("rejects overlapping ranges for the same provider, season, and idString", () => {
    const existing = {
      type: "tv" as const,
      tmdbId: 95479,
      title: "Jujutsu Kaisen",
      providers: [
        {
          season: 1,
          provider: "bilibili" as const,
          idString: "seasonId=34430",
          epRange: [1, 24] as [number, number],
          epOffset: 0,
        },
      ],
    };
    const incoming = {
      type: "tv" as const,
      tmdbId: 95479,
      title: "Jujutsu Kaisen",
      providers: [
        {
          season: 1,
          provider: "bilibili" as const,
          idString: "seasonId=34430",
          epRange: [24, 30] as [number, number],
          epOffset: 0,
        },
      ],
    };

    expect(() => mergeMappingFile(existing, incoming)).toThrow("provider entry overlaps");
  });

  test("allows overlapping ranges for different idString values and no-range entries", () => {
    const existing = {
      type: "tv" as const,
      tmdbId: 95479,
      title: "Jujutsu Kaisen",
      providers: [
        {
          season: 1,
          provider: "bilibili" as const,
          idString: "seasonId=34430",
          epRange: [1, 24] as [number, number],
          epOffset: 0,
        },
        { season: 1, provider: "bilibili" as const, idString: "seasonId=all", epOffset: 0 },
      ],
    };
    const incoming = {
      type: "tv" as const,
      tmdbId: 95479,
      title: "Jujutsu Kaisen",
      providers: [
        {
          season: 1,
          provider: "bilibili" as const,
          idString: "seasonId=45574",
          epRange: [12, 47] as [number, number],
          epOffset: -24,
        },
        { season: 1, provider: "bilibili" as const, idString: "seasonId=34430", epOffset: 0 },
      ],
    };

    const result = mergeMappingFile(existing, incoming);

    expect(result.changed).toBe(true);
    expect(result.mapping.providers).toHaveLength(4);
  });

  test("updates an existing JSON mapping file with a new provider entry", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmdb-mapping-write-"));
    const existing = {
      type: "tv" as const,
      tmdbId: 95479,
      title: "Jujutsu Kaisen",
      providers: [
        {
          season: 1,
          provider: "bilibili" as const,
          idString: "seasonId=34430",
          epRange: [1, 24] as [number, number],
          epOffset: 0,
        },
      ],
    };
    const incoming = {
      type: "tv" as const,
      tmdbId: 95479,
      title: "Jujutsu Kaisen",
      providers: [
        {
          season: 1,
          provider: "bilibili" as const,
          idString: "seasonId=45574",
          epRange: [25, 47] as [number, number],
          epOffset: -24,
        },
      ],
    };
    const dataPath = path.join(tempDir, mappingDataRelativePath(existing));
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, createMappingFileContent(existing));

    const result = writeMappingArtifacts(tempDir, 42, incoming);

    expect(result).toEqual({
      changed: true,
      changedFiles: [mappingDataRelativePath(incoming), ".changeset/tmdb-mapping-issue-42.md"],
    });
    const updated = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    expect(updated.providers).toEqual([
      { season: 1, provider: "bilibili", idString: "seasonId=34430", epRange: [1, 24], epOffset: 0 },
      { season: 1, provider: "bilibili", idString: "seasonId=45574", epRange: [25, 47], epOffset: -24 },
    ]);
  });

  test("creates a changeset for affected packages", () => {
    expect(createChangesetContent(mapping)).toContain('"@rexnow/danmu-universal": patch');
  });

  test("writes summary json when path is provided", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmdb-mapping-summary-"));
    const summaryPath = path.join(tempDir, "summary.json");

    writeMappingAgentSummary(summaryPath, {
      status: "success",
      issueNumber: 42,
      mappingTitle: "Example Show",
      mappingYear: 2025,
      changedFiles: [mappingDataRelativePath(mapping), ".changeset/tmdb-mapping-issue-42.md"],
      message: "ok",
    });

    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    expect(summary).toEqual({
      status: "success",
      issueNumber: 42,
      mappingTitle: "Example Show",
      mappingYear: 2025,
      changedFiles: [mappingDataRelativePath(mapping), ".changeset/tmdb-mapping-issue-42.md"],
      message: "ok",
    });
  });

  test("writes ambiguous summary shape without success-only fields", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmdb-mapping-summary-"));
    const summaryPath = path.join(tempDir, "summary.json");

    writeMappingAgentSummary(summaryPath, {
      status: "ambiguous",
      issueNumber: 42,
      message: "multiple candidates found",
    });

    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    expect(summary).toEqual({
      status: "ambiguous",
      issueNumber: 42,
      message: "multiple candidates found",
    });
    expect(summary.mappingTitle).toBeUndefined();
    expect(summary.changedFiles).toBeUndefined();
  });
});

describe("cli safe failure summary", () => {
  test("writes error summary when issue-body-file cannot be read", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmdb-mapping-cli-"));
    const summaryPath = path.join(tempDir, "summary.json");
    const missingIssueBodyPath = path.join(tempDir, "missing-issue-body.md");

    process.exitCode = undefined;
    const result = await runMappingAgentCli([
      "--issue",
      "42",
      "--issue-body-file",
      missingIssueBodyPath,
      "--summary-file",
      summaryPath,
    ]);

    expect(result).toEqual({
      status: "error",
      issueNumber: 42,
      message: expect.stringContaining("ENOENT"),
    });
    expect(process.exitCode).toBe(2);

    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    expect(summary).toEqual({
      status: "error",
      issueNumber: 42,
      message: expect.stringContaining("ENOENT"),
    });
  });

  test("uses GitHub workspace as CLI repo root when pnpm runs from package cwd", () => {
    expect(defaultRepoRoot({ GITHUB_WORKSPACE: "/tmp/rex-widget" })).toBe("/tmp/rex-widget");
  });
});

describe("runMappingAgent integration", () => {
  test("uses a session search/submit for unsupported provider URLs", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmdb-mapping-run-"));
    const repoRoot = tempDir;
    const mapping = {
      type: "movie" as const,
      tmdbId: 999999,
      title: "Mismatched Candidate",
      providers: [{ provider: "iqiyi" as const, idString: "entityId=demo" }],
    };
    const dataPath = path.join(repoRoot, mappingDataRelativePath(mapping));
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".changeset"), { recursive: true });

    const issueBody = `### 媒体标题（可选）

_No response_

### TMDB 链接

https://www.themoviedb.org/tv/282136

### 视频平台链接

https://example.com/watch/unknown-provider
`;
    const summaryPath = path.join(tempDir, "summary.json");
    const fetchImpl: typeof fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          title: "Mismatched Candidate",
          release_date: "2025-01-02",
          results: [],
        }),
      }) as Response;

    const summary = await withMockedFetch(fetchImpl, () =>
      runMappingAgent({
        issueNumber: 42,
        issueBody,
        repoRoot,
        summaryPath,
        env: sessionEnv,
        createSession: createFakeSession((customTools) =>
          executeLoggedSubmit(customTools, mapping, async (tools) => {
            await requireTool(tools, "search").execute("search", { query: "Mismatched Candidate" });
          }),
        ),
      }),
    );

    expect(summary).toEqual({
      status: "success",
      issueNumber: 42,
      mappingTitle: "Mismatched Candidate",
      mappingYear: 2025,
      changedFiles: [mappingDataRelativePath(mapping), ".changeset/tmdb-mapping-issue-42.md"],
      message: "TMDB mapping artifacts written for Mismatched Candidate",
    });

    const summaryFile = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    expect(summaryFile).toEqual(summary);
    const json = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    expect(json).toMatchObject({
      type: "movie",
      tmdbId: 999999,
      title: "Mismatched Candidate",
      providers: [{ provider: "iqiyi", idString: "entityId=demo" }],
    });
    expect(json).not.toHaveProperty("sourceUrl");
    expect(json).not.toHaveProperty("verifiedAt");
    expect("url" in json.providers[0]).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, ".changeset", "tmdb-mapping-issue-42.md"))).toBe(true);
    expect(fs.existsSync(dataPath)).toBe(true);
  });

  test("resolves Bilibili episode URLs with a fake mapping session", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmdb-mapping-run-"));
    const repoRoot = tempDir;
    const dataPath = path.join(repoRoot, mappingDataRelativePath(jiangyeMapping));
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".changeset"), { recursive: true });

    const issueBody = `### 媒体标题（可选）

    1

### TMDB 链接

https://www.themoviedb.org/tv/282136

### 季号（可选）

_No response_

### 视频平台链接

https://www.bilibili.com/bangumi/play/ep3409878
`;
    const summaryPath = path.join(tempDir, "summary.json");
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.startsWith("https://api.themoviedb.org/3/tv/282136")) {
        return {
          ok: true,
          json: async () => ({ name: "将夜", first_air_date: "2018-10-31" }),
        } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    };

    const summary = await withMockedFetch(fetchImpl, () =>
      runMappingAgent({
        issueNumber: 2,
        issueBody,
        repoRoot,
        summaryPath,
        env: sessionEnv,
        createSession: createFakeSession((customTools) => executeLoggedSubmit(customTools, jiangyeMapping)),
      }),
    );

    expect(summary).toMatchObject({
      status: "success",
      issueNumber: 2,
      mappingTitle: "将夜",
      mappingYear: 2018,
    });

    const json = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    expect(json).toMatchObject(jiangyeMapping);
    expect(json).not.toHaveProperty("sourceUrl");
    expect(json).not.toHaveProperty("verifiedAt");
    expect("url" in json.providers[0]).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, ".changeset", "tmdb-mapping-issue-2.md"))).toBe(true);
  });

  test("defaults missing TV season to season 1 via submit_mapping", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmdb-mapping-run-"));
    const repoRoot = tempDir;
    const dataPath = path.join(repoRoot, mappingDataRelativePath(jiangyeMapping));
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".changeset"), { recursive: true });

    const issueBody = `### 媒体标题（可选）

    1

### TMDB 链接

https://www.themoviedb.org/tv/282136

### 季号（可选）

_No response_

### 视频平台链接

https://www.bilibili.com/bangumi/play/ss45962
`;
    const summaryPath = path.join(tempDir, "summary.json");
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.startsWith("https://api.themoviedb.org/3/tv/282136")) {
        return {
          ok: true,
          json: async () => ({ name: "将夜", first_air_date: "2018-10-31" }),
        } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    };

    const summary = await withMockedFetch(fetchImpl, () =>
      runMappingAgent({
        issueNumber: 7,
        issueBody,
        repoRoot,
        summaryPath,
        env: sessionEnv,
        createSession: createFakeSession((customTools) => executeLoggedSubmit(customTools, jiangyeMapping)),
      }),
    );

    expect(summary).toMatchObject({
      status: "success",
      issueNumber: 7,
      mappingTitle: "将夜",
      mappingYear: 2018,
    });

    const seasonJson = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    expect(seasonJson).toMatchObject(jiangyeMapping);
    expect("url" in seasonJson.providers[0]).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, ".changeset", "tmdb-mapping-issue-7.md"))).toBe(true);
  });

  test("resolves MGTV drama URLs with a fake mapping session", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmdb-mapping-run-"));
    const repoRoot = tempDir;
    const mapping = {
      type: "tv" as const,
      tmdbId: 97199,
      title: "妻子的浪漫旅行",
      providers: [{ season: 6, provider: "mgtv" as const, idString: "dramaId=860862", epOffset: 0 }],
    };
    const dataPath = path.join(repoRoot, mappingDataRelativePath(mapping));
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".changeset"), { recursive: true });

    const issueBody = `### 媒体标题（可选）

_No response_

### TMDB 链接

https://www.themoviedb.org/tv/97199

### 季号（可选）

6

### 视频平台链接

https://www.mgtv.com/h/860862.html
`;
    const summaryPath = path.join(tempDir, "summary.json");
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.startsWith("https://api.themoviedb.org/3/tv/97199")) {
        return {
          ok: true,
          json: async () => ({ name: "妻子的浪漫旅行", first_air_date: "2018-08-15" }),
        } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    };

    const summary = await withMockedFetch(fetchImpl, () =>
      runMappingAgent({
        issueNumber: 6,
        issueBody,
        repoRoot,
        summaryPath,
        env: sessionEnv,
        createSession: createFakeSession((customTools) => executeLoggedSubmit(customTools, mapping)),
      }),
    );

    expect(summary).toMatchObject({
      status: "success",
      issueNumber: 6,
      mappingTitle: "妻子的浪漫旅行",
    });

    const mgtvJson = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    expect(mgtvJson).toMatchObject(mapping);
    expect("url" in mgtvJson.providers[0]).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, ".changeset", "tmdb-mapping-issue-6.md"))).toBe(true);
  });

  test("discards mapping files the fake session writes before submit", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmdb-mapping-run-"));
    const repoRoot = tempDir;
    const strayRelative = path.join("packages", "tmdb-mapping-kit", "data", "tv", "999999.json");
    const strayPath = path.join(repoRoot, strayRelative);
    fs.mkdirSync(path.dirname(strayPath), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".changeset"), { recursive: true });

    const fetchImpl: typeof fetch = async () =>
      ({
        ok: true,
        json: async () => ({ name: "将夜", first_air_date: "2018-10-31" }),
      }) as Response;

    await withMockedFetch(fetchImpl, () =>
      runMappingAgent({
        issueNumber: 9,
        issueBody: "https://www.themoviedb.org/tv/282136",
        repoRoot,
        env: sessionEnv,
        createSession: createFakeSession(async (customTools) => {
          fs.writeFileSync(strayPath, '{"type":"tv","tmdbId":999999}\n');
          expect(fs.existsSync(strayPath)).toBe(true);
          await executeLoggedSubmit(customTools, jiangyeMapping);
        }),
      }),
    );

    expect(fs.existsSync(strayPath)).toBe(false);
  });

  test("rejects confident submit after get_tmdb throws", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("TMDB down");
    };

    const summary = await withMockedFetch(fetchImpl, () =>
      runMappingAgent({
        issueNumber: 42,
        issueBody: "https://www.themoviedb.org/tv/282136",
        repoRoot: fs.mkdtempSync(path.join(os.tmpdir(), "tmdb-mapping-run-")),
        env: sessionEnv,
        createSession: createFakeSession(async (customTools) => {
          await requireTool(customTools, "get_tmdb")
            .execute("get-tmdb", { tmdbId: 282136, type: "tv" })
            .catch(() => undefined);
          await requireTool(customTools, "submit_mapping").execute("submit", {
            status: "confident",
            mapping: jiangyeMapping,
          });
        }),
      }),
    );

    expect(summary).toMatchObject({
      status: "error",
      message: "get_tmdb is required before a confident submit",
    });
  });

  test("rejects confident submit when get_tmdb succeeds but probe and list_episodes fail", async () => {
    const { listEpisodesTool } = await import("./mapping-agent-tools/provider.ts");
    rs.mocked(listEpisodesTool).mockResolvedValue({ ok: false, error: "scrape failed" });

    const fetchImpl: typeof fetch = async () =>
      ({
        ok: true,
        json: async () => ({ name: "将夜", first_air_date: "2018-10-31" }),
      }) as Response;

    const summary = await withMockedFetch(fetchImpl, () =>
      runMappingAgent({
        issueNumber: 42,
        issueBody: "https://www.themoviedb.org/tv/282136",
        repoRoot: fs.mkdtempSync(path.join(os.tmpdir(), "tmdb-mapping-run-")),
        env: sessionEnv,
        createSession: createFakeSession(async (customTools) => {
          await requireTool(customTools, "get_tmdb").execute("get-tmdb", {
            tmdbId: jiangyeMapping.tmdbId,
            type: jiangyeMapping.type,
          });
          await requireTool(customTools, "probe_mapping").execute("probe", { mapping: jiangyeMapping });
          await requireTool(customTools, "list_episodes").execute("list", {
            provider: "bilibili",
            idString: "seasonId=45962",
          });
          await requireTool(customTools, "submit_mapping").execute("submit", {
            status: "confident",
            mapping: jiangyeMapping,
          });
        }),
      }),
    );

    expect(summary).toMatchObject({
      status: "error",
      message: "probe_mapping or list_episodes is required before a confident submit",
    });
  });
});
