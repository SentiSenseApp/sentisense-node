import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { VERSION } from "../src/version.js";

/**
 * VERSION is hand-maintained and is what the client reports in its User-Agent, so it is how
 * we see which SDK release a caller is on. It had drifted a release behind package.json,
 * meaning that signal was quietly wrong, and nothing failed. This pins the two together.
 */
describe("VERSION", () => {
  it("matches the package.json version", () => {
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
    );
    expect(VERSION).toBe(pkg.version);
  });
});
