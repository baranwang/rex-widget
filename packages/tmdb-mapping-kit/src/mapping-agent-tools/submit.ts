import { providerNames } from "@rexnow/scraper-kit/provider-metadata";
import { parseProviderIdStringFor } from "@rexnow/scraper-kit/provider-url";
import { z } from "zod";
import { episodeRangeSchema } from "../schema.ts";

const providerEnumSchema = z.enum(providerNames);

const mappingCandidateBaseProviderFields = {
  provider: providerEnumSchema,
  idString: z.string(),
  url: z.string().optional(),
};

function hasValidProviderIdString(provider: (typeof providerNames)[number], idString: string): boolean {
  try {
    parseProviderIdStringFor(provider, idString);
    return true;
  } catch (error) {
    void error;
    return false;
  }
}

function validateProviderIdString(
  provider: { provider: (typeof providerNames)[number]; idString: string },
  ctx: z.RefinementCtx,
): void {
  if (hasValidProviderIdString(provider.provider, provider.idString)) {
    return;
  }
  ctx.addIssue({
    code: "custom",
    path: ["idString"],
    message: "idString must be valid for the selected provider",
  });
}

const mappingCandidateMovieProviderSchema = z
  .object(mappingCandidateBaseProviderFields)
  .strict()
  .superRefine(validateProviderIdString);

const mappingCandidateTvProviderSchema = z
  .object(mappingCandidateBaseProviderFields)
  .extend({
    season: z.number().int().nonnegative(),
    epRange: episodeRangeSchema.optional(),
    epOffset: z.number().int().default(0),
  })
  .strict()
  .superRefine(validateProviderIdString);

export const mappingCandidateSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("movie"),
      tmdbId: z.number().int().nonnegative(),
      title: z.string().min(1),
      providers: z.array(mappingCandidateMovieProviderSchema),
    })
    .strict(),
  z
    .object({
      type: z.literal("tv"),
      tmdbId: z.number().int().nonnegative(),
      title: z.string().min(1),
      providers: z.array(mappingCandidateTvProviderSchema),
    })
    .strict(),
]);

export type MappingCandidateProvider = z.output<
  typeof mappingCandidateMovieProviderSchema | typeof mappingCandidateTvProviderSchema
>;
export type MappingCandidate = z.output<typeof mappingCandidateSchema>;

export const modelResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("confident"),
    mapping: mappingCandidateSchema,
    reason: z.string().optional(),
  }),
  z.object({
    status: z.literal("ambiguous"),
    reason: z.string().min(1),
  }),
]);

export type SubmitMapping = z.infer<typeof modelResponseSchema>;

export type ToolCallLog = { name: string };

export function parseSubmitMapping(value: unknown): SubmitMapping {
  return modelResponseSchema.parse(value);
}
