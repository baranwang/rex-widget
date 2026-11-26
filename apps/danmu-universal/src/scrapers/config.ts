import { globalParamsConfigSchema as sharedGlobalParamsConfigSchema } from "@rexnow/scraper-kit";
import { z } from "../libs/zod";

export type { Unflatten } from "@rexnow/scraper-kit";

const appGlobalParamsConfigSchema = z
  .object({
    "global.content.preserveDanmakuColor": z
      .enum(["true", "false"])
      .catch("true")
      .transform((value) => value === "true"),
    "global.mediaRef.apiKey": z.string().trim().catch(""),
  })
  .transform((value) => ({
    global: {
      content: {
        preserveDanmakuColor: value["global.content.preserveDanmakuColor"],
      },
      // 用户没填就用构建时注入的默认 key（仓库 secret MEDIAREF_API_KEY）。
      mediaRef: { apiKey: value["global.mediaRef.apiKey"] || process.env.MEDIAREF_API_KEY || "" },
    },
  }));

export const globalParamsConfigSchema = z.intersection(sharedGlobalParamsConfigSchema, appGlobalParamsConfigSchema);

export type GlobalParamsConfig = z.infer<typeof globalParamsConfigSchema>;
