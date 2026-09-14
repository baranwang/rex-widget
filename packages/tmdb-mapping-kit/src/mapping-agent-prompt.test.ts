import { describe, expect, test } from "@rstest/core";
import { buildMappingAgentSystemPrompt } from "./mapping-agent-prompt.ts";

describe("buildMappingAgentSystemPrompt", () => {
  test("includes required guidance", () => {
    const prompt = buildMappingAgentSystemPrompt();
    expect(prompt).toContain("submit_mapping");
    expect(prompt).toContain("untrusted");
    expect(prompt).toContain("probe_mapping");
    expect(prompt).not.toContain("writeMappingArtifacts");
  });
});
