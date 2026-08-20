import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearConfig,
  configPath,
  maskKey,
  readConfig,
  resolveConfigDir,
  writeConfig,
} from "../../src/cli/config.js";

const created: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sentisense-cli-"));
  created.push(dir);
  return dir;
}

afterEach(() => {
  while (created.length > 0) {
    const dir = created.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("resolveConfigDir", () => {
  it("prefers the injected directory over everything", () => {
    expect(
      resolveConfigDir({ SENTISENSE_CONFIG_DIR: "/env", XDG_CONFIG_HOME: "/xdg" }, "/injected"),
    ).toBe("/injected");
  });

  it("uses SENTISENSE_CONFIG_DIR next", () => {
    expect(resolveConfigDir({ SENTISENSE_CONFIG_DIR: "/env", XDG_CONFIG_HOME: "/xdg" })).toBe("/env");
  });

  it("falls back to the XDG location", () => {
    expect(resolveConfigDir({ XDG_CONFIG_HOME: "/xdg" })).toBe(join("/xdg", "sentisense"));
  });

  it("ends at ~/.config/sentisense", () => {
    expect(resolveConfigDir({})).toMatch(/\.config[/\\]sentisense$/);
  });
});

describe("writeConfig", () => {
  it("writes the file owner-readable only", () => {
    const dir = tempDir();
    writeConfig(dir, { apiKey: "ssk_stored" });
    const mode = statSync(configPath(dir)).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("tightens permissions on a file that already existed", () => {
    // writeFileSync only applies its mode when it creates the file, so a rewrite has to
    // chmod explicitly or a world-readable config stays world-readable.
    const dir = tempDir();
    writeFileSync(configPath(dir), "{}", { mode: 0o644 });
    writeConfig(dir, { apiKey: "ssk_stored" });
    expect(statSync(configPath(dir)).mode & 0o777).toBe(0o600);
  });

  it("round-trips the stored fields", () => {
    const dir = tempDir();
    writeConfig(dir, { apiKey: "ssk_stored", agentName: "desk", baseUrl: "https://example.test" });
    expect(readConfig(dir)).toEqual({
      apiKey: "ssk_stored",
      agentName: "desk",
      baseUrl: "https://example.test",
    });
  });
});

describe("readConfig", () => {
  it("reads a missing file as nothing stored", () => {
    expect(readConfig(tempDir())).toEqual({});
  });

  it("reads a corrupt file as nothing stored rather than failing every command", () => {
    const dir = tempDir();
    writeFileSync(configPath(dir), "{ not json");
    expect(readConfig(dir)).toEqual({});
  });

  it("ignores fields of the wrong type", () => {
    const dir = tempDir();
    writeFileSync(configPath(dir), JSON.stringify({ apiKey: 42, agentName: "desk" }));
    expect(readConfig(dir)).toEqual({ agentName: "desk" });
  });
});

describe("clearConfig", () => {
  it("removes a stored file and reports it", () => {
    const dir = tempDir();
    writeConfig(dir, { apiKey: "ssk_stored" });
    expect(clearConfig(dir)).toBe(true);
    expect(readConfig(dir)).toEqual({});
  });

  it("reports false when there was nothing stored", () => {
    expect(clearConfig(tempDir())).toBe(false);
  });
});

describe("maskKey", () => {
  it("shows the ends and nothing else", () => {
    expect(maskKey("ssk_live_abcdefgh1234")).toBe("ssk_...1234");
  });

  it("hides a short value entirely", () => {
    expect(maskKey("short")).toBe("*****");
  });
});
