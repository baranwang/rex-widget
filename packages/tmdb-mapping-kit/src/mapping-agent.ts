import fs from "node:fs";
import path from "node:path";
import { type HttpAdapterRequestOptions, initializeFetchAdapter } from "@rexnow/scraper-kit/runtime";
import {
  type MappingSessionFactory,
  restoreMappingWorkspace,
  runPiMappingSession,
  snapshotMappingWorkspace,
} from "./mapping-agent-session.ts";
import type { MappingCandidate, SubmitMapping } from "./mapping-agent-tools/submit.ts";
import type { CanonicalMapping } from "./schema.ts";
import { canonicalMappingSchema } from "./schema.ts";

export type { MappingCandidate, MappingCandidateProvider } from "./mapping-agent-tools/submit.ts";
export { mappingCandidateSchema, modelResponseSchema } from "./mapping-agent-tools/submit.ts";

export type IssueFormFields = {
  media_title?: string;
  media_type: "movie" | "tv";
  tmdb_url: string;
  season?: number | null;
  platform_urls: string[];
  notes?: string;
};

export type TmdbMetadata = {
  title: string;
  year?: number;
};

export type MappingAgentOptions = {
  issueNumber: number;
  issueBody: string;
  repoRoot?: string;
  env?: NodeJS.ProcessEnv;
  summaryPath?: string;
  createSession?: MappingSessionFactory;
};

export type MappingAgentSummary = {
  status: "success" | "ambiguous" | "error";
  issueNumber: number;
  message: string;
  mappingTitle?: string;
  mappingYear?: number;
  changedFiles?: string[];
};

export const mappingArtifactPaths = ["packages/tmdb-mapping-kit/data"] as const;

const mappingAgentRequestTimeoutMs = 120_000;

function mappingAgentRequestSignal(): AbortSignal {
  return AbortSignal.timeout(mappingAgentRequestTimeoutMs);
}

export { mappingModelSelection, modelSelection } from "./mapping-agent-env.ts";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mappingAgentLog(message: string, details?: Record<string, unknown>): void {
  const suffix = details && Object.keys(details).length > 0 ? ` ${JSON.stringify(details)}` : "";
  console.log(`[tmdb-mapping-agent] ${new Date().toISOString()} ${message}${suffix}`);
}

async function loggedStep<T>(name: string, action: () => Promise<T>, details?: Record<string, unknown>): Promise<T> {
  const startedAt = Date.now();
  mappingAgentLog(`${name}: start`, details);
  try {
    const result = await action();
    mappingAgentLog(`${name}: success`, { durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    mappingAgentLog(`${name}: failed`, { durationMs: Date.now() - startedAt, error: errorMessage(error) });
    throw error;
  }
}

function responseHeaders(response: Response): Record<string, string> {
  return response.headers ? Object.fromEntries(response.headers.entries()) : {};
}

function responseStatus(response: Response): number {
  return response.status ?? (response.ok ? 200 : 0);
}

function initializeMappingFetchAdapter() {
  initializeFetchAdapter({
    async get<T>(url: string, options?: HttpAdapterRequestOptions) {
      const startedAt = Date.now();
      mappingAgentLog("http get: start", { url });
      try {
        const response = await fetch(url, {
          headers: options?.headers,
          signal: mappingAgentRequestSignal(),
        });
        const result = {
          data: (await response.json()) as T,
          statusCode: responseStatus(response),
          headers: responseHeaders(response),
        };
        mappingAgentLog("http get: success", {
          url,
          statusCode: result.statusCode,
          durationMs: Date.now() - startedAt,
        });
        return result;
      } catch (error) {
        mappingAgentLog("http get: failed", { url, durationMs: Date.now() - startedAt, error: errorMessage(error) });
        throw error;
      }
    },
    async post<T>(url: string, body: unknown, options?: HttpAdapterRequestOptions) {
      const startedAt = Date.now();
      mappingAgentLog("http post: start", { url });
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: options?.headers,
          body: typeof body === "string" ? body : JSON.stringify(body),
          signal: mappingAgentRequestSignal(),
        });
        const result = {
          data: (await response.json()) as T,
          statusCode: responseStatus(response),
          headers: responseHeaders(response),
        };
        mappingAgentLog("http post: success", {
          url,
          statusCode: result.statusCode,
          durationMs: Date.now() - startedAt,
        });
        return result;
      } catch (error) {
        mappingAgentLog("http post: failed", { url, durationMs: Date.now() - startedAt, error: errorMessage(error) });
        throw error;
      }
    },
  });
}

function fail(message: string): never {
  throw new Error(message);
}

class AmbiguousMappingError extends Error {}

function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    fail(`${name} is required`);
  }
  return value;
}

function parseTmdbUrl(value: string): { mediaType: "movie" | "tv"; tmdbId: number } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail("tmdb_url must be a valid URL");
  }
  if (url.hostname !== "www.themoviedb.org" && url.hostname !== "themoviedb.org") {
    fail("tmdb_url must point to themoviedb.org");
  }
  const [, mediaType, idSegment] = url.pathname.split("/");
  if (mediaType !== "movie" && mediaType !== "tv") {
    fail("tmdb_url path must start with /movie/ or /tv/");
  }
  const tmdbId = Number(idSegment);
  if (!Number.isInteger(tmdbId) || tmdbId < 0) {
    fail("tmdb_url must contain a numeric TMDB id");
  }
  return { mediaType, tmdbId };
}

export function toCanonicalMapping(candidate: MappingCandidate): CanonicalMapping {
  if (candidate.type === "movie") {
    return canonicalMappingSchema.parse({
      type: "movie",
      tmdbId: candidate.tmdbId,
      title: candidate.title,
      providers: candidate.providers.map(({ provider, idString }) => ({ provider, idString })),
    });
  }
  return canonicalMappingSchema.parse({
    type: "tv",
    tmdbId: candidate.tmdbId,
    title: candidate.title,
    providers: candidate.providers.map(({ season, provider, idString, epRange, epOffset }) => ({
      season,
      provider,
      idString,
      ...(epRange === undefined ? {} : { epRange }),
      epOffset,
    })),
  });
}

export async function fetchTmdbMetadata(fields: IssueFormFields, env: NodeJS.ProcessEnv): Promise<TmdbMetadata> {
  const { tmdbId } = parseTmdbUrl(fields.tmdb_url);
  const token = requiredEnv(env, "TMDB_ACCESS_TOKEN");
  const language = env.TMDB_LANGUAGE || "zh-CN";
  const tmdbMetadataUrl = `https://api.themoviedb.org/3/${fields.media_type}/${tmdbId}?language=${encodeURIComponent(language)}`;
  const response = await loggedStep(
    "fetch TMDB metadata",
    () =>
      fetch(tmdbMetadataUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: mappingAgentRequestSignal(),
      }),
    { mediaType: fields.media_type, tmdbId, language },
  );
  if (!response.ok) {
    fail(`TMDB metadata fetch failed with status ${response.status}`);
  }
  const data = (await response.json()) as Record<string, unknown>;
  const title =
    fields.media_type === "movie"
      ? (typeof data.title === "string" && data.title) ||
        (typeof data.original_title === "string" && data.original_title)
      : (typeof data.name === "string" && data.name) || (typeof data.original_name === "string" && data.original_name);
  if (!title) {
    fail("TMDB metadata response did not include a title");
  }
  const dateValue = fields.media_type === "movie" ? data.release_date : data.first_air_date;
  const year = typeof dateValue === "string" && /^\d{4}/.test(dateValue) ? Number(dateValue.slice(0, 4)) : undefined;
  mappingAgentLog("TMDB metadata parsed", { title, year: year ?? null });
  return { title, year };
}

export function createChangesetContent(mapping: CanonicalMapping): string {
  return [
    "---",
    '"@rexnow/danmu-universal": patch',
    "---",
    "",
    `Add TMDB local mapping for ${mapping.title}.`,
    "",
  ].join("\n");
}

function canonicalDataPath(repoRoot: string, mapping: Pick<CanonicalMapping, "type" | "tmdbId">): string {
  return path.join(repoRoot, mappingDataRelativePath(mapping));
}

function changesetPath(repoRoot: string, issueNumber: number): string {
  return path.join(repoRoot, ".changeset", `tmdb-mapping-issue-${issueNumber}.md`);
}

export function mappingDataRelativePath(mapping: Pick<CanonicalMapping, "type" | "tmdbId">): string {
  return path.join("packages", "tmdb-mapping-kit", "data", mapping.type, `${mapping.tmdbId}.json`);
}

function providerSortKey(provider: CanonicalMapping["providers"][number]): string {
  if ("season" in provider) {
    const range = provider.epRange ? `${provider.epRange[0]}-${provider.epRange[1]}` : "all";
    return `${provider.season}:${provider.provider}:${provider.idString}:${range}:${provider.epOffset}`;
  }
  return `${provider.provider}:${provider.idString}`;
}

function orderedProvider(provider: CanonicalMapping["providers"][number]) {
  if ("season" in provider) {
    return {
      season: provider.season,
      provider: provider.provider,
      idString: provider.idString,
      ...(provider.epRange === undefined ? {} : { epRange: provider.epRange }),
      epOffset: provider.epOffset,
    };
  }
  return { provider: provider.provider, idString: provider.idString };
}

function orderedMapping(mapping: CanonicalMapping): CanonicalMapping {
  const providers = [...mapping.providers].sort((left, right) =>
    providerSortKey(left).localeCompare(providerSortKey(right)),
  );
  return {
    type: mapping.type,
    tmdbId: mapping.tmdbId,
    title: mapping.title,
    providers: providers.map(orderedProvider),
  } as CanonicalMapping;
}

export function createMappingFileContent(mapping: CanonicalMapping): string {
  return `${JSON.stringify(orderedMapping(mapping), null, 2)}\n`;
}

function sameProviderEntry(
  left: CanonicalMapping["providers"][number],
  right: CanonicalMapping["providers"][number],
): boolean {
  return JSON.stringify(orderedProvider(left)) === JSON.stringify(orderedProvider(right));
}

function rangesOverlap(left: readonly [number, number], right: readonly [number, number]): boolean {
  return left[0] <= right[1] && right[0] <= left[1];
}

function assertMergeableProvider(
  existing: CanonicalMapping["providers"][number],
  incoming: CanonicalMapping["providers"][number],
): void {
  if (!("season" in existing) || !("season" in incoming)) {
    return;
  }
  if (
    existing.provider !== incoming.provider ||
    existing.season !== incoming.season ||
    existing.idString !== incoming.idString ||
    existing.epRange === undefined ||
    incoming.epRange === undefined
  ) {
    return;
  }
  if (rangesOverlap(existing.epRange, incoming.epRange)) {
    fail("provider entry overlaps an existing provider entry for the same provider, season, and idString");
  }
}

export function mergeMappingFile(
  existing: CanonicalMapping | null,
  incoming: CanonicalMapping,
): { mapping: CanonicalMapping; changed: boolean } {
  if (!existing) {
    return { mapping: incoming, changed: true };
  }
  if (existing.type !== incoming.type || existing.tmdbId !== incoming.tmdbId) {
    fail("existing mapping file does not match incoming mapping identity");
  }
  const mergedProviders = [...existing.providers];
  let changed = false;
  for (const incomingProvider of incoming.providers) {
    if (mergedProviders.some((existingProvider) => sameProviderEntry(existingProvider, incomingProvider))) {
      continue;
    }
    for (const existingProvider of mergedProviders) {
      assertMergeableProvider(existingProvider, incomingProvider);
    }
    mergedProviders.push(incomingProvider);
    changed = true;
  }
  return {
    mapping: canonicalMappingSchema.parse({
      type: incoming.type,
      tmdbId: incoming.tmdbId,
      title: incoming.title || existing.title,
      providers: mergedProviders,
    }),
    changed,
  };
}

export function readExistingMappingFile(dataPath: string): CanonicalMapping | null {
  if (!fs.existsSync(dataPath)) {
    return null;
  }
  return canonicalMappingSchema.parse(JSON.parse(fs.readFileSync(dataPath, "utf8")));
}

export function writeMappingArtifacts(
  repoRoot: string,
  issueNumber: number,
  mapping: CanonicalMapping,
): { changedFiles: string[]; changed: boolean } {
  const dataPath = canonicalDataPath(repoRoot, mapping);
  const mergeResult = mergeMappingFile(readExistingMappingFile(dataPath), mapping);
  if (!mergeResult.changed) {
    return { changedFiles: [], changed: false };
  }
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, createMappingFileContent(mergeResult.mapping));
  const changesetFilePath = changesetPath(repoRoot, issueNumber);
  fs.mkdirSync(path.dirname(changesetFilePath), { recursive: true });
  fs.writeFileSync(changesetFilePath, createChangesetContent(mapping));
  return {
    changedFiles: [mappingDataRelativePath(mapping), `.changeset/tmdb-mapping-issue-${issueNumber}.md`],
    changed: true,
  };
}

function summaryChangedFiles(
  issueNumber: number,
  mapping: CanonicalMapping,
  artifacts: { changedFiles: string[] },
): string[] {
  return artifacts.changedFiles.length > 0
    ? artifacts.changedFiles
    : [mappingDataRelativePath(mapping), `.changeset/tmdb-mapping-issue-${issueNumber}.md`];
}

export function writeMappingAgentSummary(summaryPath: string | undefined, summary: MappingAgentSummary): void {
  if (!summaryPath) {
    return;
  }
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
}

export async function runMappingAgent(options: MappingAgentOptions): Promise<MappingAgentSummary> {
  const repoRoot = options.repoRoot ?? process.cwd();
  const env = options.env ?? process.env;
  initializeMappingFetchAdapter();
  mappingAgentLog("run started", {
    issueNumber: options.issueNumber,
    repoRoot,
    summaryPath: options.summaryPath ?? null,
  });
  const snapshot = snapshotMappingWorkspace(repoRoot);
  try {
    const toolLog: string[] = [];
    let submitted: SubmitMapping;
    try {
      submitted = await runPiMappingSession({
        issueNumber: options.issueNumber,
        issueBody: options.issueBody,
        repoRoot,
        env,
        createSession: options.createSession,
        toolLog,
      });
    } finally {
      restoreMappingWorkspace(repoRoot, snapshot);
    }
    if (submitted.status === "ambiguous") {
      throw new AmbiguousMappingError(submitted.reason);
    }
    if (!toolLog.includes("get_tmdb")) {
      throw new Error("get_tmdb is required before a confident submit");
    }
    if (!toolLog.includes("probe_mapping") && !toolLog.includes("list_episodes")) {
      throw new Error("probe_mapping or list_episodes is required before a confident submit");
    }
    const mapping = toCanonicalMapping(submitted.mapping);
    mappingAgentLog("canonical mapping created", {
      type: mapping.type,
      tmdbId: mapping.tmdbId,
      title: mapping.title,
      providerCount: mapping.providers.length,
    });
    const artifacts = writeMappingArtifacts(repoRoot, options.issueNumber, mapping);
    mappingAgentLog("mapping artifacts evaluated", {
      changed: artifacts.changed,
      changedFiles: artifacts.changedFiles,
    });
    const summary: MappingAgentSummary = {
      status: "success",
      issueNumber: options.issueNumber,
      mappingTitle: mapping.title,
      changedFiles: summaryChangedFiles(options.issueNumber, mapping, artifacts),
      message: artifacts.changed
        ? `TMDB mapping artifacts written for ${mapping.title}`
        : `TMDB mapping already up to date for ${mapping.title}`,
    };
    writeMappingAgentSummary(options.summaryPath, summary);
    mappingAgentLog("run completed", { status: summary.status, message: summary.message });
    return summary;
  } catch (error) {
    const message = errorMessage(error);
    const summary: MappingAgentSummary = {
      status: error instanceof AmbiguousMappingError ? "ambiguous" : "error",
      issueNumber: options.issueNumber,
      message,
    };
    writeMappingAgentSummary(options.summaryPath, summary);
    mappingAgentLog("run completed", { status: summary.status, message });
    return summary;
  }
}

export function parseCliArgs(args: string[]): number {
  return parseMappingAgentArgs(args).issue;
}

export function parseMappingAgentArgs(args: string[]): { issue: number; issueBodyFile: string; summaryFile: string } {
  const issueIndex = args.indexOf("--issue");
  const issueBodyFileIndex = args.indexOf("--issue-body-file");
  const summaryFileIndex = args.indexOf("--summary-file");

  const issue = issueIndex === -1 ? Number.NaN : Number(args[issueIndex + 1]);
  const issueBodyFile = issueBodyFileIndex === -1 ? "" : (args[issueBodyFileIndex + 1] ?? "");
  const summaryFile = summaryFileIndex === -1 ? "" : (args[summaryFileIndex + 1] ?? "");

  if (!Number.isInteger(issue) || issue <= 0) {
    fail("usage: tmdb:mapping-agent -- --issue <number> --issue-body-file <path> --summary-file <path>");
  }
  if (!issueBodyFile.trim()) {
    fail("usage: tmdb:mapping-agent -- --issue <number> --issue-body-file <path> --summary-file <path>");
  }
  if (!summaryFile.trim()) {
    fail("usage: tmdb:mapping-agent -- --issue <number> --issue-body-file <path> --summary-file <path>");
  }

  return {
    issue,
    issueBodyFile,
    summaryFile,
  };
}

export function defaultRepoRoot(env: NodeJS.ProcessEnv = process.env): string {
  return env.GITHUB_WORKSPACE || path.resolve(import.meta.dirname, "..", "..", "..");
}

export async function runMappingAgentCli(args: string[]): Promise<MappingAgentSummary> {
  const parsed = parseMappingAgentArgs(args);

  try {
    const issueBody = fs.readFileSync(parsed.issueBodyFile, "utf8");
    const summary = await runMappingAgent({
      issueNumber: parsed.issue,
      issueBody,
      repoRoot: defaultRepoRoot(),
      summaryPath: parsed.summaryFile,
    });
    if (summary.status !== "success") {
      process.exitCode = 2;
    }
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const summary: MappingAgentSummary = {
      status: "error",
      issueNumber: parsed.issue,
      message,
    };
    writeMappingAgentSummary(parsed.summaryFile, summary);
    process.exitCode = 2;
    return summary;
  }
}
