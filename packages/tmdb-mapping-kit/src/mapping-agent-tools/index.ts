import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { MappingToolDetail } from "../mapping-agent-evidence.ts";
import type { CanonicalMapping } from "../schema.ts";
import { toolJson } from "./json-result.ts";
import { listExistingMapping, previewMerge, probeMapping } from "./mapping-inspect.ts";
import {
  listEpisodesTool,
  makeIdStringTool,
  parseEpisodeTitleTool,
  parseIdStringTool,
  parseProviderUrlTool,
} from "./provider.ts";
import { searchCatalog } from "./search/index.ts";
import { parseSubmitMapping, type SubmitMapping } from "./submit.ts";
import { getTmdb } from "./tmdb.ts";

export const mappingAgentToolNames = [
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
] as const;

export type { SubmitMapping, ToolCallLog } from "./submit.ts";
export { parseSubmitMapping } from "./submit.ts";

function toolResult(result: unknown) {
  return {
    content: [{ type: "text" as const, text: toolJson(result) }],
    details: result,
  };
}

export function createMappingTools(options: {
  env: NodeJS.ProcessEnv;
  repoRoot: string;
  onTool: (name: string, detail?: MappingToolDetail) => void;
  onSubmit: (value: SubmitMapping) => void;
}) {
  const { env, repoRoot, onTool, onSubmit } = options;

  const search = defineTool({
    name: "search",
    label: "Search",
    description: "Search TMDB and supported platform catalogs",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      scope: Type.Optional(
        Type.Union([Type.Literal("all"), Type.Literal("tmdb"), Type.Literal("platforms")], {
          description: "Search scope; defaults to all",
        }),
      ),
      type: Type.Optional(Type.Union([Type.Literal("movie"), Type.Literal("tv")])),
      year: Type.Optional(Type.Number()),
      season: Type.Optional(Type.Number()),
      providers: Type.Optional(Type.Array(Type.String())),
      limit: Type.Optional(Type.Number()),
    }),
    async execute(_toolCallId, params) {
      onTool("search");
      const result = await searchCatalog(params, env);
      return toolResult(result);
    },
  });

  const getTmdbTool = defineTool({
    name: "get_tmdb",
    label: "Get TMDB",
    description: "Fetch TMDB details for a movie or TV show",
    parameters: Type.Object({
      tmdbId: Type.Number({ description: "TMDB numeric id" }),
      type: Type.Union([Type.Literal("movie"), Type.Literal("tv")]),
      season: Type.Optional(Type.Number({ description: "TMDB season number for episode list" })),
    }),
    async execute(_toolCallId, params) {
      const result = await getTmdb(params, env);
      onTool("get_tmdb", { getTmdb: { tmdbId: params.tmdbId, type: params.type, title: result.title } });
      return toolResult(result);
    },
  });

  const parseProviderUrl = defineTool({
    name: "parse_provider_url",
    label: "Parse Provider URL",
    description: "Parse a platform URL into provider and idString",
    parameters: Type.Object({
      url: Type.String({ description: "Platform page URL" }),
    }),
    async execute(_toolCallId, params) {
      onTool("parse_provider_url");
      const result = await parseProviderUrlTool(params.url);
      return toolResult(result);
    },
  });

  const parseIdString = defineTool({
    name: "parse_id_string",
    label: "Parse idString",
    description: "Parse a provider idString into structured fields",
    parameters: Type.Object({
      provider: Type.String(),
      idString: Type.String(),
    }),
    execute(_toolCallId, params) {
      onTool("parse_id_string");
      const result = parseIdStringTool(params.provider, params.idString);
      return toolResult(result);
    },
  });

  const makeIdString = defineTool({
    name: "make_id_string",
    label: "Make idString",
    description: "Build a provider idString from structured fields",
    parameters: Type.Object({
      provider: Type.String(),
      id: Type.Record(Type.String(), Type.Unknown()),
    }),
    execute(_toolCallId, params) {
      onTool("make_id_string");
      const result = makeIdStringTool(params.provider, params.id);
      return toolResult(result);
    },
  });

  const parseEpisodeTitle = defineTool({
    name: "parse_episode_title",
    label: "Parse Episode Title",
    description: "Parse a variety episode title into number, part, and edition",
    parameters: Type.Object({
      title: Type.String(),
    }),
    execute(_toolCallId, params) {
      onTool("parse_episode_title");
      const result = parseEpisodeTitleTool(params.title);
      return toolResult(result);
    },
  });

  const listEpisodes = defineTool({
    name: "list_episodes",
    label: "List Episodes",
    description: "List episodes from a provider idString",
    parameters: Type.Object({
      provider: Type.String(),
      idString: Type.String(),
      episodeNumber: Type.Optional(Type.Number()),
      episodeName: Type.Optional(Type.String()),
      airDate: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params) {
      const result = await listEpisodesTool(params);
      if (result.ok === true) {
        onTool("list_episodes", {
          listEpisodes: {
            provider: params.provider,
            idString: params.idString,
            episodeCount: result.episodes.length,
            ...(params.episodeNumber === undefined ? {} : { episodeNumber: params.episodeNumber }),
          },
        });
      }
      return toolResult(result);
    },
  });

  const listExistingMappingTool = defineTool({
    name: "list_existing_mapping",
    label: "List Existing Mapping",
    description: "Read the canonical mapping file for a TMDB id if it exists",
    parameters: Type.Object({
      type: Type.Union([Type.Literal("movie"), Type.Literal("tv")]),
      tmdbId: Type.Number(),
    }),
    execute(_toolCallId, params) {
      onTool("list_existing_mapping");
      const result = listExistingMapping(repoRoot, params);
      return toolResult(result);
    },
  });

  const previewMergeTool = defineTool({
    name: "preview_merge",
    label: "Preview Merge",
    description: "Dry-run merging a canonical mapping into the repo data file",
    parameters: Type.Object({
      mapping: Type.Unknown({ description: "Canonical mapping JSON" }),
    }),
    execute(_toolCallId, params) {
      onTool("preview_merge");
      const result = previewMerge(repoRoot, params.mapping as CanonicalMapping);
      return toolResult(result);
    },
  });

  const probeMappingTool = defineTool({
    name: "probe_mapping",
    label: "Probe Mapping",
    description: "Probe provider entries in a mapping by fetching episodes",
    parameters: Type.Object({
      mapping: Type.Unknown({ description: "Canonical mapping JSON" }),
      sampleEpisode: Type.Optional(Type.Number()),
    }),
    async execute(_toolCallId, params) {
      const result = await probeMapping(repoRoot, params.mapping as CanonicalMapping, params.sampleEpisode);
      const probe = result
        .filter((item) => item.ok)
        .map((item) => ({
          provider: item.provider,
          idString: item.idString,
          episodeCount: item.episodes.length,
          ...(item.season === undefined ? {} : { season: item.season }),
          ...(item.epRange === undefined ? {} : { epRange: item.epRange }),
          ...(item.epOffset === undefined ? {} : { epOffset: item.epOffset }),
        }));
      if (probe.some((item) => item.episodeCount > 0)) {
        onTool("probe_mapping", { probe });
      }
      return toolResult(result);
    },
  });

  const submitMapping = defineTool({
    name: "submit_mapping",
    label: "Submit Mapping",
    description: "Submit the final mapping result and end the agent run",
    parameters: Type.Object({
      status: Type.Union([Type.Literal("confident"), Type.Literal("ambiguous")]),
      mapping: Type.Optional(Type.Unknown()),
      reason: Type.Optional(Type.String()),
    }),
    execute(_toolCallId, params) {
      onTool("submit_mapping");
      const value = parseSubmitMapping(params);
      onSubmit(value);
      return {
        content: [{ type: "text" as const, text: "submitted" }],
        details: value,
        terminate: true,
      };
    },
  });

  return [
    search,
    getTmdbTool,
    parseProviderUrl,
    parseIdString,
    makeIdString,
    parseEpisodeTitle,
    listEpisodes,
    listExistingMappingTool,
    previewMergeTool,
    probeMappingTool,
    submitMapping,
  ];
}
