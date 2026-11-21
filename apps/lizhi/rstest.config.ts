import { defineConfig } from "@rstest/core";

export default defineConfig({
  testEnvironment: "node",
  setupFiles: ["./scripts/rstest.setup.ts"],
});
