import { globalParamsConfigSchema as sharedGlobalParamsConfigSchema } from "@rexnow/scraper-kit";
import { z } from "../libs/zod";

export type { Unflatten } from "@rexnow/scraper-kit";

const appGlobalParamsConfigSchema = z
  .object({
    "global.content.preserveDanmakuColor": z.stringbool().catch(true),
  })
  .transform((value) => ({
    global: {
      content: {
        preserveDanmakuColor: value["global.content.preserveDanmakuColor"],
      },
    },
  }));

export const globalParamsConfigSchema = z.intersection(sharedGlobalParamsConfigSchema, appGlobalParamsConfigSchema);

export type GlobalParamsConfig = z.infer<typeof globalParamsConfigSchema>;
