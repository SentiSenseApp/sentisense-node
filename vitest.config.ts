import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Every test file runs with a global fetch that throws, so the suite cannot reach the
    // network. Tests stub fetch themselves; see tests/setup/noNetwork.ts.
    setupFiles: ["tests/setup/noNetwork.ts"],
  },
});
