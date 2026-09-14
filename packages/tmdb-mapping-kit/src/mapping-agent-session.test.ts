import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, rs, test } from "@rstest/core";
import { runMappingAgent } from "./mapping-agent.ts";
import { restoreMappingWorkspace, runPiMappingSession, snapshotMappingWorkspace } from "./mapping-agent-session.ts";

rs.mock("./mapping-agent-tools/provider.ts", () => ({
  listEpisodesTool: rs.fn(async () => ({
    ok: true,
    episodes: [{ episodeNumber: 1, episodeName: "e1" }],
  })),
}));

const tempDirs: string[] = [];

function tempRepo(): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mapping-session-"));
  tempDirs.push(repoRoot);
  return repoRoot;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

const sessionEnv = {
  PI_API_KEY: "k",
  PI_MODEL: "gpt-5.4-mini",
  PI_PROVIDER: "openai",
  TMDB_ACCESS_TOKEN: "t",
};

describe("snapshotMappingWorkspace / restoreMappingWorkspace", () => {
  test("restores original mapping files after a fake agent writes extras", () => {
    const repoRoot = tempRepo();
    const originalPath = path.join(repoRoot, "packages", "tmdb-mapping-kit", "data", "tv", "1.json");
    const extraPath = path.join(repoRoot, "packages", "tmdb-mapping-kit", "data", "tv", "999.json");
    fs.mkdirSync(path.dirname(originalPath), { recursive: true });
    fs.writeFileSync(originalPath, "original\n");

    const snapshot = snapshotMappingWorkspace(repoRoot);
    fs.writeFileSync(originalPath, "edited\n");
    fs.writeFileSync(extraPath, "extra\n");

    restoreMappingWorkspace(repoRoot, snapshot);

    expect(fs.existsSync(extraPath)).toBe(false);
    expect(fs.readFileSync(originalPath, "utf8")).toBe("original\n");
  });
});

describe("runPiMappingSession", () => {
  test("returns submit_mapping from the injected session factory", async () => {
    const submitted = await runPiMappingSession({
      issueNumber: 42,
      issueBody: "### TMDB 链接\n\nhttps://www.themoviedb.org/tv/282136",
      repoRoot: tempRepo(),
      env: sessionEnv,
      createSession: async ({ customTools }) => {
        const submit = customTools.find((tool) => tool.name === "submit_mapping");
        return {
          session: {
            subscribe: () => () => {},
            prompt: async () => {
              await submit.execute("1", {
                status: "ambiguous",
                reason: "need platform url",
              });
            },
            abort: async () => {},
            dispose: () => {},
          },
        };
      },
    });
    expect(submitted).toEqual({ status: "ambiguous", reason: "need platform url" });
  });

  test("aborts when the twelfth turn ends", async () => {
    const abort = rs.fn(async () => {});
    let onEvent: ((event: { type: string }) => void) | undefined;
    await runPiMappingSession({
      issueNumber: 42,
      issueBody: "body",
      repoRoot: tempRepo(),
      env: sessionEnv,
      createSession: async ({ customTools }) => {
        const submit = customTools.find((tool) => tool.name === "submit_mapping");
        return {
          session: {
            subscribe: (listener) => {
              onEvent = listener;
              return () => {};
            },
            prompt: async () => {
              for (let i = 0; i < 11; i += 1) {
                onEvent?.({ type: "turn_end" });
              }
              expect(abort).not.toHaveBeenCalled();
              onEvent?.({ type: "turn_end" });
              expect(abort).toHaveBeenCalledTimes(1);
              await submit.execute("1", { status: "ambiguous", reason: "capped" });
            },
            abort,
            dispose: () => {},
          },
        };
      },
    });
  });
});

describe("runMappingAgent host gates", () => {
  beforeEach(async () => {
    const { listEpisodesTool } = await import("./mapping-agent-tools/provider.ts");
    rs.mocked(listEpisodesTool).mockReset();
    rs.mocked(listEpisodesTool).mockResolvedValue({
      ok: true,
      episodes: [{ episodeNumber: 1, episodeName: "e1" }],
    });
  });

  test("rejects confident submit without get_tmdb in the tool log", async () => {
    const summary = await runMappingAgent({
      issueNumber: 42,
      issueBody: "### TMDB 链接\n\nhttps://www.themoviedb.org/tv/282136",
      repoRoot: tempRepo(),
      env: sessionEnv,
      createSession: async ({ customTools }) => {
        const submit = customTools.find((tool) => tool.name === "submit_mapping");
        return {
          session: {
            subscribe: () => () => {},
            prompt: async () => {
              await submit.execute("1", {
                status: "confident",
                mapping: {
                  type: "movie",
                  tmdbId: 1,
                  title: "Demo",
                  providers: [{ provider: "iqiyi", idString: "entityId=demo" }],
                },
              });
            },
            abort: async () => {},
            dispose: () => {},
          },
        };
      },
    });
    expect(summary).toMatchObject({
      status: "error",
      message: "get_tmdb is required before a confident submit",
    });
  });
});
