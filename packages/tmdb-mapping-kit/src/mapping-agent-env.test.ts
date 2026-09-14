import { describe, expect, test } from "@rstest/core";
import { mappingModelSelection, modelSelection } from "./mapping-agent-env.ts";

describe("mappingModelSelection", () => {
  test("prefers PI_ vars over OPENCODE_ vars", () => {
    expect(
      mappingModelSelection({
        PI_API_KEY: "pi-key",
        PI_BASE_URL: "https://pi.example/v1",
        PI_MODEL: "gpt-5.4-mini",
        PI_PROVIDER: "openai",
        OPENCODE_API_KEY: "old-key",
        OPENCODE_MODEL: "ignored/model",
      }),
    ).toEqual({
      providerID: "openai",
      modelID: "gpt-5.4-mini",
      apiKey: "pi-key",
      baseUrl: "https://pi.example/v1",
    });
  });

  test("falls back to OPENCODE_ provider/model split", () => {
    expect(
      mappingModelSelection({
        OPENCODE_API_KEY: "oc-key",
        OPENCODE_MODEL: "custom/model-a",
      }),
    ).toEqual({
      providerID: "custom",
      modelID: "model-a",
      apiKey: "oc-key",
    });
  });

  test("requires an API key", () => {
    expect(() => mappingModelSelection({ PI_MODEL: "gpt-5.4-mini", PI_PROVIDER: "openai" })).toThrow(
      "PI_API_KEY or OPENCODE_API_KEY is required",
    );
  });
});

describe("modelSelection compatibility", () => {
  test("keeps provider/model parsing without exposing secrets", () => {
    expect(modelSelection({ OPENCODE_MODEL: "custom/model-a" })).toEqual({
      providerID: "custom",
      modelID: "model-a",
    });
  });
});
