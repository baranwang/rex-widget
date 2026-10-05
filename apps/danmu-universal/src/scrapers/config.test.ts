import { describe, expect, test } from "@rstest/core";
import { globalParamsConfigSchema } from "./config";

describe("preserveDanmakuColor config", () => {
  test.each([
    [{}, true],
    [{ "global.content.preserveDanmakuColor": "true" }, true],
    [{ "global.content.preserveDanmakuColor": "false" }, false],
    [{ "global.content.preserveDanmakuColor": "invalid" }, true],
    [{ "global.content.preserveDanmakuColor": false }, true],
  ])("parses preserveDanmakuColor from %j as %s", (input, expected) => {
    expect(globalParamsConfigSchema.parse(input).global.content.preserveDanmakuColor).toBe(expected);
  });

  test("preserveDanmakuColor keeps shared configuration", () => {
    const config = globalParamsConfigSchema.parse({
      "global.content.aggregation": "false",
      "global.content.conversion": "tc2sc",
      "provider.renren.mode": "choice",
      "global.content.preserveDanmakuColor": "false",
    });

    expect(config.global.content.aggregation).toBe(false);
    expect(config.global.content.conversion).toBe("tc2sc");
    expect(config.provider.renren.mode).toBe("choice");
    expect(config.global.content.preserveDanmakuColor).toBe(false);
    expect(config.global.experimental.doubanHistory.enabled).toBe(false);
  });
});
