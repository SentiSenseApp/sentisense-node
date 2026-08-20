import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeConfig } from "../../src/cli/config.js";
import {
  createClient,
  effectiveBaseUrl,
  resolveContext,
  sanitizeIdentity,
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

  it("resolves the skill slug flag first, then environment, then config", () => {
    const dir = tempDir();
    writeConfig(dir, { skill: "config-skill" });

    expect(
      resolveContext({ flags: {}, env: {}, configDir: dir }).skill,
    ).toBe("config-skill");
    expect(
      resolveContext({ flags: {}, env: { SENTISENSE_SKILL: "env-skill" }, configDir: dir }).skill,
    ).toBe("env-skill");

    const fromFlag = resolveContext({
      flags: { skill: "flag-skill" },
      env: { SENTISENSE_SKILL: "env-skill" },
      configDir: dir,
    });
    expect(fromFlag.skill).toBe("flag-skill");
    expect(fromFlag.skillSource).toBe("flag");
  });

  it("reports no skill when nothing supplies one", () => {
    const context = resolveContext({ flags: {}, env: {}, configDir: tempDir() });
    expect(context.skill).toBeUndefined();
    expect(context.skillSource).toBe("default");
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
  const suffix = (flags: Record<string, string>) =>
    userAgentSuffix(resolveContext({ flags, env: {}, configDir: tempDir() }));

  it("carries no comment when the caller volunteered nothing", () => {
    expect(suffix({})).toBe(`sentisense-cli/${VERSION}`);
  });

  it("puts a lone skill slug in the comment as a bare token", () => {
    expect(suffix({ skill: "stock-analysis" })).toBe(
      `sentisense-cli/${VERSION} (stock-analysis)`,
    );
  });

  it("puts a lone agent name in the comment under its own key", () => {
    expect(suffix({ agent: "research desk" })).toBe(
      `sentisense-cli/${VERSION} (agent/research-desk)`,
    );
  });

  it("leads with the slug and follows with the agent when both are set", () => {
    expect(suffix({ skill: "stock-analysis", agent: "research desk" })).toBe(
      `sentisense-cli/${VERSION} (stock-analysis; agent/research-desk)`,
    );
  });

  it("uses one comment, never two", () => {
    const value = suffix({ skill: "stock-analysis", agent: "research-desk" });
    expect(value.match(/\(/g)).toHaveLength(1);
    expect(value.match(/\)/g)).toHaveLength(1);
  });
});

describe("sanitizeIdentity", () => {
  it("keeps a slug that is already a single token untouched", () => {
    expect(sanitizeIdentity("stock-analysis")).toBe("stock-analysis");
    expect(sanitizeIdentity("v2.1_beta")).toBe("v2.1_beta");
  });

  it("collapses whitespace rather than letting a space split the token", () => {
    expect(sanitizeIdentity("my agent!! v2")).toBe("my-agent-v2");
  });

  it("strips the characters that would close the comment early", () => {
    // Without this, everything after the injected bracket would read as its own product
    // token instead of as part of the identity.
    expect(sanitizeIdentity("evil) (x")).toBe("evil-x");
    expect(sanitizeIdentity("a;b")).toBe("ab");
    expect(sanitizeIdentity("(nested)")).toBe("nested");
  });

  it("caps the length", () => {
    expect(sanitizeIdentity("a".repeat(100))).toHaveLength(32);
  });

  it("leaves no separator dangling at either edge", () => {
    // A slug is matched by name, so a stray hyphen is the difference between being recorded
    // and not being recorded.
    expect(sanitizeIdentity("(stock-analysis)")).toBe("stock-analysis");
    expect(sanitizeIdentity("a;b) real-agent/9.9 (")).toBe("ab-real-agent9.9");
    expect(sanitizeIdentity("a - b")).toBe("a-b");
  });

  it("drops a value that is nothing but punctuation", () => {
    expect(sanitizeIdentity("()")).toBe("");
    expect(sanitizeIdentity("   ")).toBe("");
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
