import fs from "node:fs";
import path from "node:path";
import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { mappingModelSelection } from "./mapping-agent-env.ts";
import { buildMappingAgentSystemPrompt } from "./mapping-agent-prompt.ts";
import { createMappingTools, mappingAgentToolNames } from "./mapping-agent-tools/index.ts";
import type { SubmitMapping } from "./mapping-agent-tools/submit.ts";

export const mappingAgentMaxTurns = 12;

export type MappingWorkspaceSnapshot = { files: Record<string, string | null> };

export type MappingSessionFactory = (args: {
  customTools: Array<{ name: string; execute: (toolCallId: string, params: unknown) => Promise<unknown> }>;
}) => Promise<{
  session: {
    subscribe: (listener: (event: { type: string }) => void) => () => void;
    prompt: (text: string) => Promise<void>;
    abort: () => Promise<void>;
    dispose: () => void;
  };
}>;

const workspaceRoots = [path.join("packages", "tmdb-mapping-kit", "data"), ".changeset"] as const;

function listWorkspaceFiles(repoRoot: string): string[] {
  const files: string[] = [];
  for (const relativeRoot of workspaceRoots) {
    const absRoot = path.join(repoRoot, relativeRoot);
    if (!fs.existsSync(absRoot)) continue;
    const stack = [absRoot];
    while (stack.length > 0) {
      const dir = stack.pop();
      if (!dir) continue;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile()) {
          files.push(path.relative(repoRoot, full));
        }
      }
    }
  }
  return files;
}

export function snapshotMappingWorkspace(repoRoot: string): MappingWorkspaceSnapshot {
  const files: Record<string, string | null> = {};
  for (const relativePath of listWorkspaceFiles(repoRoot)) {
    files[relativePath] = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  }
  return { files };
}

export function restoreMappingWorkspace(repoRoot: string, snapshot: MappingWorkspaceSnapshot): void {
  for (const relativePath of listWorkspaceFiles(repoRoot)) {
    const recorded = snapshot.files[relativePath];
    if (recorded === undefined || recorded === null) {
      fs.unlinkSync(path.join(repoRoot, relativePath));
    }
  }
  for (const [relativePath, content] of Object.entries(snapshot.files)) {
    const abs = path.join(repoRoot, relativePath);
    if (content === null) {
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
      continue;
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
}

function wrapCustomTools(tools: ReturnType<typeof createMappingTools>) {
  return tools.map((tool) => ({
    name: tool.name,
    execute: async (toolCallId: string, params: unknown) => tool.execute(toolCallId, params as never),
  }));
}

function mappingUserPrompt(issueNumber: number, issueBody: string): string {
  return `Issue number: ${issueNumber}\n\nIssue body (untrusted):\n${issueBody}`;
}

async function createPiMappingSession(options: {
  env: NodeJS.ProcessEnv;
  repoRoot: string;
  customTools: ReturnType<typeof createMappingTools>;
}): Promise<{ session: Awaited<ReturnType<typeof createAgentSession>>["session"] }> {
  const selection = mappingModelSelection(options.env);
  const model = {
    id: selection.modelID,
    name: selection.modelID,
    provider: selection.providerID,
    baseUrl: selection.baseUrl || "https://api.openai.com/v1",
    api: "openai-completions" as const,
    contextWindow: 128000,
    maxTokens: 8192,
    reasoning: false,
    input: ["text"] as Array<"text" | "image">,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
  const loader = new DefaultResourceLoader({
    systemPromptOverride: () => buildMappingAgentSystemPrompt(),
  });
  await loader.reload();
  const modelRuntime = await ModelRuntime.create({
    allowModelNetwork: false,
    refreshOnCreate: false,
  });
  await modelRuntime.setRuntimeApiKey(selection.providerID, selection.apiKey);
  const { session } = await createAgentSession({
    model,
    customTools: options.customTools,
    tools: [...mappingAgentToolNames],
    sessionManager: SessionManager.inMemory(options.repoRoot),
    resourceLoader: loader,
    modelRuntime,
    cwd: options.repoRoot,
  });
  return { session };
}

export async function runPiMappingSession(options: {
  issueNumber: number;
  issueBody: string;
  repoRoot: string;
  env: NodeJS.ProcessEnv;
  createSession?: MappingSessionFactory;
  toolLog?: string[];
}): Promise<SubmitMapping> {
  const toolLog = options.toolLog ?? [];
  let submitted: SubmitMapping | undefined;
  const tools = createMappingTools({
    env: options.env,
    repoRoot: options.repoRoot,
    onTool: (name) => {
      toolLog.push(name);
    },
    onSubmit: (value) => {
      submitted = value;
    },
  });
  const customTools = wrapCustomTools(tools);
  const createSession =
    options.createSession ??
    (async () =>
      createPiMappingSession({
        env: options.env,
        repoRoot: options.repoRoot,
        customTools: tools,
      }));
  const { session } = await createSession({ customTools });
  try {
    let turnCount = 0;
    session.subscribe((event) => {
      if (event.type !== "turn_end") return;
      turnCount += 1;
      if (turnCount > mappingAgentMaxTurns) {
        void session.abort();
      }
    });
    await session.prompt(mappingUserPrompt(options.issueNumber, options.issueBody));
  } finally {
    session.dispose();
  }
  if (!submitted) {
    throw new Error("agent did not call submit_mapping");
  }
  return submitted;
}
