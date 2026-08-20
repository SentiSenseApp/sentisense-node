import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2020",
    outExtension({ format }) {
      return {
        js: format === "cjs" ? ".cjs" : ".mjs",
      };
    },
  },
  {
    // The bin. CommonJS only, because that is what runs everywhere without a package.json
    // type field mattering, and there is nothing to import from it.
    entry: { cli: "src/cli/main.ts" },
    format: ["cjs"],
    dts: false,
    // The library build above runs first and owns the clean.
    clean: false,
    sourcemap: false,
    target: "es2020",
    banner: { js: "#!/usr/bin/env node" },
    outExtension() {
      return { js: ".cjs" };
    },
  },
]);
