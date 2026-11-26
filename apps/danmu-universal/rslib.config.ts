import { pluginRexWidget } from "@rexnow/rslib-plugin";
import { defineConfig } from "@rslib/core";
import pkg from "./package.json";

export default defineConfig({
  source: {
    define: {
      "process.env.PACKAGE_VERSION": JSON.stringify(pkg.version),
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
      "process.env.MEDIAREF_API_KEY": JSON.stringify(process.env.MEDIAREF_API_KEY ?? ""),
      "import.meta.rstest": false,
    },
  },
  lib: [
    {
      format: "esm",
      syntax: "es6",
      bundle: true,
      source: {
        entry: {
          "danmu-universal": "./src/index.ts",
        },
      },
    },
    {
      format: "esm",
      syntax: "es6",
      bundle: true,
      source: {
        entry: {
          "danmu-universal.lite": "./src/index.ts",
        },
      },
    },
  ],
  output: {
    target: "web",
    autoExternal: false,
    minify: {
      jsOptions: {
        minimizerOptions: {
          mangle: true,
          minify: false,
          compress: true,
          format: {
            comments: false,
          },
        },
      },
    },
  },
  tools: {
    rspack: {
      optimization: {
        moduleIds: "deterministic",
      },
    },
  },
  // 产物里带着默认 MediaRef key，生产构建加密。
  plugins: [pluginRexWidget({ encrypt: true })],
});
