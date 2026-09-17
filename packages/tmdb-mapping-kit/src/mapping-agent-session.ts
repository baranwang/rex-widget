import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { mappingModelSelection } from "./mapping-agent-env.ts";
import {
  createMappingToolEvidence,
  type MappingToolEvidence,
  recordMappingToolEvidence,
} from "./mapping-agent-evidence.ts";
import { buildMappingAgentSystemPrompt } from "./mapping-agent-prompt.ts";
import { createMappingTools, mappingAgentToolNames } from "./mapping-agent-tools/index.ts";
import type { SubmitMapping } from "./mapping-agent-tools/submit.ts";

export const mappingAgentMaxTurns = 12;

export type MappingWorkspaceSnapshot = { files: Record<string, string | null> };

export type MappingSessionMessage = {
  role?: string;
  stopReason?: string;
  errorMessage?: string;
};

export type MappingSessionFactory = (args: {
  customTools: Array<{ name: string; execute: (toolCallId: string, params: unknown) => Promise<unknown> }>;
}) => Promise<{
  session: {
    subscribe: (listener: (event: { type: string }) => void) => () => void;
    prompt: (text: string) => Promise<void>;
    abort: () => Promise<void>;
    dispose: () => void;
    messages?: MappingSessionMessage[];
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

const openaiCompatibleProviderId = "openai-compatible";

export function mappingGatewayRegistration(selection: ReturnType<typeof mappingModelSelection>) {
  const providerId = selection.providerID === "openai" ? openaiCompatibleProviderId : selection.providerID;
  const baseUrl = selection.baseUrl || "https://api.openai.com/v1";
  const compat = { sendSessionAffinityHeaders: true };
  const modelDef = {
    id: selection.modelID,
    name: selection.modelID,
    api: "openai-completions" as const,
    reasoning: false,
    input: ["text"] as Array<"text" | "image">,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
    compat,
  };
  return {
    providerId,
    model: { ...modelDef, provider: providerId, baseUrl, compat },
    config: {
      name: providerId === openaiCompatibleProviderId ? "OpenAI-compatible" : providerId,
      baseUrl,
      api: "openai-completions" as const,
      compat,
      models: [modelDef],
    },
  };
}

export function mappingSessionFailure(options: { submitted?: unknown; messages: MappingSessionMessage[] }): string {
  for (let index = options.messages.length - 1; index >= 0; index -= 1) {
    const message = options.messages[index];
    if (message?.role === "assistant" && message.stopReason === "error" && message.errorMessage) {
      return message.errorMessage;
    }
  }
  return "agent did not call submit_mapping";
}

async function createPiMappingSession(options: {
  env: NodeJS.ProcessEnv;
  repoRoot: string;
  customTools: ReturnType<typeof createMappingTools>;
}): Promise<{ session: Awaited<ReturnType<typeof createAgentSession>>["session"] }> {
  const selection = mappingModelSelection(options.env);
  const registration = mappingGatewayRegistration(selection);
  const emptyTempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmdb-mapping-agent-"));
  const loader = new DefaultResourceLoader({
    cwd: options.repoRoot,
    agentDir: emptyTempDir,
    settingsManager: SettingsManager.inMemory(),
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPromptOverride: () => buildMappingAgentSystemPrompt(),
    skillsOverride: () => ({ skills: [], diagnostics: [] }),
    promptsOverride: () => ({ prompts: [], diagnostics: [] }),
    agentsFilesOverride: () => ({ agentsFiles: [] }),
    appendSystemPromptOverride: () => [],
  });
  await loader.reload();
  const modelRuntime = await ModelRuntime.create({
    allowModelNetwork: false,
    refreshOnCreate: false,
    authPath: path.join(emptyTempDir, "auth.json"),
    modelsPath: path.join(emptyTempDir, "models.json"),
  });
  modelRuntime.registerProvider(registration.providerId, registration.config);
  await modelRuntime.setRuntimeApiKey(registration.providerId, selection.apiKey);
  const { session } = await createAgentSession({
    model: registration.model,
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
  toolEvidence?: MappingToolEvidence;
}): Promise<SubmitMapping> {
  const toolLog = options.toolLog ?? [];
  const toolEvidence = options.toolEvidence ?? createMappingToolEvidence();
  let submitted: SubmitMapping | undefined;
  const tools = createMappingTools({
    env: options.env,
    repoRoot: options.repoRoot,
    onTool: (name, detail) => {
      toolLog.push(name);
      recordMappingToolEvidence(toolEvidence, detail);
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
  let messages: MappingSessionMessage[] = [];
  try {
    let turnCount = 0;
    session.subscribe((event) => {
      if (event.type !== "turn_end") return;
      turnCount += 1;
      if (turnCount >= mappingAgentMaxTurns) {
        void session.abort();
      }
    });
    await session.prompt(mappingUserPrompt(options.issueNumber, options.issueBody));
    messages = Array.isArray(session.messages) ? session.messages : [];
  } finally {
    session.dispose();
  }
  if (!submitted) {
    throw new Error(mappingSessionFailure({ submitted, messages }));
  }
  return submitted;
}
