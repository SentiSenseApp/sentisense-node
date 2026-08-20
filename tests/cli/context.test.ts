import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeConfig } from "../../src/cli/config.js";
import {
  createClient,
  effectiveBaseUrl,
  resolveContext,
  sanitizeAgent,
  userAgentSuffix,
} from "../../src/cli/context.js";
import { MissingKeyError } from "../../src/cli/errors.js";
import { VERSION } from "../../src/version.js";

const created: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sentisense-ctx-"));
  created.push(dir);
  return dir;
}

afterEach(() => {
  while (created.length > 0) {
    const dir = created.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("resolveContext precedence", () => {
  it("prefers a flag over the environment and the stored file", () => {
    const dir = tempDir();
    writeConfig(dir, { apiKey: "from_config" });
    const context = resolveContext({
      flags: { "api-key": "from_flag" },
      env: { SENTISENSE_API_KEY: "from_env" },
      configDir: dir,
    });
    expect(context.apiKey).toBe("from_flag");
    expect(context.apiKeySource).toBe("flag");
  });

  it("prefers the environment over the stored file", () => {
    const dir = tempDir();
    writeConfig(dir, { apiKey: "from_config" });
    const context = resolveContext({
      flags: {},
      env: { SENTISENSE_API_KEY: "from_env" },
      configDir: dir,
    });
    expect(context.apiKey).toBe("from_env");
    expect(context.apiKeySource).toBe("env");
  });

  it("falls back to the stored file", () => {
    const dir = tempDir();
    writeConfig(dir, { apiKey: "from_config" });
    const context = resolveContext({ flags: {}, env: {}, configDir: dir });
    expect(context.apiKey).toBe("from_config");
    expect(context.apiKeySource).toBe("config");
  });

  it("reports no key when nothing supplies one", () => {
    const context = resolveContext({ flags: {}, env: {}, configDir: tempDir() });
    expect(context.apiKey).toBeUndefined();
    expect(context.apiKeySource).toBe("default");
  });

  it("applies the same order to the base URL and the agent name", () => {
    const dir = tempDir();
    writeConfig(dir, { baseUrl: "https://config.test", agentName: "config-agent" });
    const fromEnv = resolveContext({
      flags: {},
      env: { SENTISENSE_BASE_URL: "https://env.test", SENTISENSE_AGENT_NAME: "env-agent" },
      configDir: dir,
    });
    expect(fromEnv.baseUrl).toBe("https://env.test");
    expect(fromEnv.agentName).toBe("env-agent");

    const fromFlag = resolveContext({
      flags: { "base-url": "https://flag.test", agent: "flag-agent" },
      env: { SENTISENSE_BASE_URL: "https://env.test", SENTISENSE_AGENT_NAME: "env-agent" },
      configDir: dir,
    });
    expect(fromFlag.baseUrl).toBe("https://flag.test");
    expect(fromFlag.agentName).toBe("flag-agent");

    const fromConfig = resolveContext({ flags: {}, env: {}, configDir: dir });
    expect(fromConfig.baseUrl).toBe("https://config.test");
    expect(fromConfig.agentName).toBe("config-agent");
  });

  it("ignores a whitespace-only environment value", () => {
    const dir = tempDir();
    writeConfig(dir, { apiKey: "from_config" });
    const context = resolveContext({
      flags: {},
      env: { SENTISENSE_API_KEY: "   " },
      configDir: dir,
    });
    expect(context.apiKey).toBe("from_config");
  });

  it("defaults the base URL to production", () => {
    const context = resolveContext({ flags: {}, env: {}, configDir: tempDir() });
    expect(effectiveBaseUrl(context)).toBe("https://app.sentisense.ai");
  });
});

describe("userAgentSuffix", () => {
  it("always names the CLI", () => {
    const context = resolveContext({ flags: {}, env: {}, configDir: tempDir() });
    expect(userAgentSuffix(context)).toBe(`sentisense-cli/${VERSION}`);
  });

  it("adds the agent label when one is configured", () => {
    const context = resolveContext({ flags: { agent: "research desk" }, env: {}, configDir: tempDir() });
    expect(userAgentSuffix(context)).toBe(`sentisense-cli/${VERSION} agent/research-desk`);
  });

  it("keeps the label header-safe", () => {
    expect(sanitizeAgent("my agent!! v2")).toBe("my-agent-v2");
  });
});

describe("createClient", () => {
  it("refuses to build a keyed client with no key", () => {
    const context = resolveContext({ flags: {}, env: {}, configDir: tempDir() });
    expect(() => createClient(context)).toThrow(MissingKeyError);
  });

  it("builds an anonymous client with no key, for the reachability probe", () => {
    const context = resolveContext({ flags: {}, env: {}, configDir: tempDir() });
    expect(createClient(context, { anonymous: true })).toBeDefined();
  });
});
