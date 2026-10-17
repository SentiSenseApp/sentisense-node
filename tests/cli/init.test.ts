import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { errorResponse, jsonResponse, routeFetch, run } from "./harness.js";
import { describeError } from "../../src/cli/errors.js";
import { AuthenticationError, RateLimitError } from "../../src/errors.js";

const KEY = "ss_live_0123456789abcdef0123456789abcdef";
const KEEP_URL = "https://app.sentisense.ai/keep-key?utm_source=cli-init&utm_medium=cli#token=Abc_DEF-0123456789abcdefghijklmnopqrstuvwxyz";
const MINTED = {
  apiKey: KEY,
  expiresAt: 1792512000, // 2026-10-20T16:00:00Z
  keepUntil: 1793462400, // 2026-10-31T16:00:00Z
  keepUrl: KEEP_URL,
  limits: { requestsPerMinute: 10, requestsPerDay: 500, requestsTotal: 1000 },
  docs: { llms: "https://sentisense.ai/llms.txt", skill: "https://sentisense.ai/skill.md" },
};

const OTHER = "ss_live_otherotherotherotherotherother";

let configDir: string;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), "sentisense-config-"));
});

afterEach(() => {
  rmSync(configDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const mintRoute = (payload: unknown = jsonResponse(MINTED, 201)) =>
  routeFetch([[/\/api\/v1\/keys\/provision$/, payload]]);

/** Words this feature never prints: it hands out a free key, so no offer and no paid plan. */
const BANNED_WORDS = ["trial", "pricing", "upgrade"];

/** House rule for everything this feature prints. */
function expectNeutralCopy(text: string) {
  for (const word of BANNED_WORDS) expect(text.toLowerCase()).not.toContain(word);
  expect(text).not.toMatch(/\bPRO\b/);
  expect(text).not.toContain("\u2014");
}

describe("sentisense init", () => {
  it("mints a temporary key and prints it as an env line with the keep link, writing nothing in the project", async () => {
    const fetch = mintRoute();
    const result = await run(["init", "--plain"], { fetch, configDir });

    expect(result.code).toBe(0);
    expect(result.urls).toEqual(["https://app.sentisense.ai/api/v1/keys/provision"]);
    const init = result.inits[0] as { method: string; headers: Record<string, string> };
    expect(init.method).toBe("POST");
    expect(init.headers["X-SentiSense-API-Key"]).toBeUndefined();
    expect(init.headers["User-Agent"]).toContain("sentisense-cli/");

    expect(result.stdout.split("\n")[0]).toBe(`SENTISENSE_API_KEY=${KEY}`);
    expect(result.stdout).toContain(KEEP_URL);
    expect(result.stdout).toContain("Keep this key");
    expect(result.stdout).toContain("working until 2026-10-20 16:00 UTC unless kept");
    expect(result.stdout).toContain("1,000 requests in all (at most 500 a day, 10 a minute)");
    expect(result.stdout).toContain("works until 2026-10-31 16:00 UTC, even after the key stops");
    expect(result.stdout).toContain("https://sentisense.ai/llms.txt");
    expectNeutralCopy(result.stdout);

    // The only file init writes is its own install id, inside the CLI's config directory.
    expect(readdirSync(configDir)).toEqual(["install-id"]);
  });

  it("returns the key, link and limits as JSON for an agent", async () => {
    const result = await run(["init", "--json"], { fetch: mintRoute(), configDir });

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      apiKey: KEY,
      envVar: "SENTISENSE_API_KEY",
      temporary: true,
      expiresAt: 1792512000,
      keepUntil: 1793462400,
      keepUrl: KEEP_URL,
      limits: { requestsPerMinute: 10, requestsPerDay: 500, requestsTotal: 1000 },
      docs: { llms: "https://sentisense.ai/llms.txt", skill: "https://sentisense.ai/skill.md" },
    });
  });

  it("sends a stable per-install id with the request, and only to the key endpoint", async () => {
    const first = await run(["init"], { fetch: mintRoute(), configDir });
    const id = (first.inits[0] as { headers: Record<string, string> }).headers["X-SentiSense-Client-Id"];
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(readFileSync(join(configDir, "install-id"), "utf8").trim()).toBe(id);
    expect(statSync(join(configDir, "install-id")).mode & 0o777).toBe(0o600);

    const second = await run(["init"], { fetch: mintRoute(), configDir });
    expect((second.inits[0] as { headers: Record<string, string> }).headers["X-SentiSense-Client-Id"]).toBe(id);
  });

  it("sends no install id when it cannot be stored", async () => {
    // A file where the config directory should be: nothing can be written under it.
    const blocker = join(configDir, "not-a-dir");
    writeFileSync(blocker, "x");
    const result = await run(["init"], { fetch: mintRoute(), configDir: join(blocker, "sentisense") });
    expect(result.code).toBe(0);
    expect((result.inits[0] as { headers: Record<string, string> }).headers["X-SentiSense-Client-Id"]).toBeUndefined();
  });

  it("makes no new key when one is already configured, and says where it came from", async () => {
    const cases: Array<[string[], Record<string, string>, string]> = [
      [[], { SENTISENSE_API_KEY: OTHER }, "SENTISENSE_API_KEY environment variable"],
      [["--api-key", OTHER], {}, "the key passed with --api-key"],
    ];
    for (const [flags, env, words] of cases) {
      const fetch = mintRoute();
      const result = await run(["init", "--plain", ...flags], { fetch, env, configDir });
      expect(result.code).toBe(0);
      expect(fetch).not.toHaveBeenCalled();
      expect(result.stdout).toContain(words);
      expect(result.stdout).toContain("No new key was made");
      expect(result.stdout).toContain("sentisense init --new");
      expect(result.stdout).not.toContain(OTHER);
      expectNeutralCopy(result.stdout);
    }

    const json = await run(["init", "--json"], { fetch: mintRoute(), env: { SENTISENSE_API_KEY: OTHER }, configDir });
    const out = JSON.parse(json.stdout);
    expect(out.apiKey).toBeNull();
    expect(out.configured.source).toBe("env");
    expect(out.configured.masked).not.toContain(OTHER);
  });

  it("--new mints a fresh key without sending the configured one", async () => {
    const fetch = mintRoute();
    const result = await run(["init", "--new", "--json"], { fetch, env: { SENTISENSE_API_KEY: OTHER }, configDir });

    expect(result.code).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((result.inits[0] as { headers: Record<string, string> }).headers["X-SentiSense-API-Key"]).toBeUndefined();
    expect(JSON.parse(result.stdout).apiKey).toBe(KEY);
  });

  describe("when no key can be had, it says what to do instead", () => {
    const cases: Array<[string, Response, number]> = [
      ["the server does not offer it (404)", errorResponse(404, {}), 3],
      [
        "the server predates it and wants a key (401)",
        errorResponse(401, { error: "api_key_required", message: "API key (header `X-SentiSense-API-Key`) is required" }),
        3,
      ],
      [
        "today's keys for this network are used up (429)",
        errorResponse(429, { error: "provision_limit_reached", message: "This network has used today's temporary keys." }, { "Retry-After": "3600" }),
        5,
      ],
      ["the network is blocked (403)", errorResponse(403, { error: "account_blocked", message: "We couldn't complete this request." }), 3],
      ["the server is down (503)", errorResponse(503, { error: "provision_unavailable", message: "Unavailable right now." }), 1],
      [
        "new keys are paused for today (503)",
        errorResponse(
          503,
          {
            error: "provision_paused",
            message: "We're onboarding a lot of new builders right now, so new keys are paused for today.",
          },
          { "Retry-After": "3600" },
        ),
        5,
      ],
      [
        "this network already has keys it never kept (429)",
        errorResponse(429, { error: "keep_existing_key", message: "Keep your existing key." }),
        5,
      ],
      ["the answer is not a key", jsonResponse({ ...MINTED, apiKey: `${KEY}\nEVIL=1` }, 201), 1],
    ];

    for (const [label, response, code] of cases) {
      it(label, async () => {
        const result = await run(["init"], { fetch: mintRoute(response), configDir });

        expect(result.code).toBe(code);
        expect(result.stdout).not.toContain("SENTISENSE_API_KEY=");
        expect(result.stderr).toContain("https://app.sentisense.ai/get-api-key");
        expectNeutralCopy(result.stderr);
      });
    }
  });

  it("says plainly that a server without the endpoint does not hand out keys", async () => {
    const result = await run(["init"], {
      fetch: mintRoute(errorResponse(401, { error: "api_key_required", message: "API key is required" })),
      configDir,
    });
    expect(result.stderr).toContain("does not hand out keys from the command line");
    expect(result.stderr).not.toContain("API key is required");
  });

  it("passes the pause along in the server's words and says when to come back", async () => {
    const result = await run(["init"], {
      fetch: mintRoute(
        errorResponse(503, {
          error: "provision_paused",
          message: "We're onboarding a lot of new builders right now, so new keys are paused for today.",
        }),
      ),
      configDir,
    });
    expect(result.stderr).toContain("new keys are paused for today");
    expect(result.stderr).toContain("try again after 00:00 UTC");
  });

  it("points a network with unkept keys at keeping one", async () => {
    const result = await run(["init"], {
      fetch: mintRoute(errorResponse(429, { error: "keep_existing_key", message: "Keep your existing key." })),
      configDir,
    });
    expect(result.stderr).toContain("open the keep link that came with the key");
  });

  it("rejects arguments", async () => {
    const result = await run(["init", "./my-app"], { fetch: mintRoute(), configDir });
    expect(result.code).toBe(2);
  });

  it("help names the command and its flag", async () => {
    const result = await run(["help", "init"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("--new");
    expect(result.stdout).toContain("writes nothing into your project");
    expectNeutralCopy(result.stdout);
  });
});

describe("errors a temporary key can get from any command", () => {
  it("points at keeping the key, never at a paid plan", () => {
    const limit = describeError(new RateLimitError("This temporary key has used its 500 requests for today.", "key_limit_reached", 120), false, "quote");
    expect(limit.exitCode).toBe(5);
    expect(limit.lines.join("\n")).toContain("keep the key");
    expectNeutralCopy(limit.lines.join("\n"));

    const expired = describeError(new AuthenticationError("This temporary key has expired.", 401, "key_expired"), false, "quote");
    expect(expired.exitCode).toBe(3);
    expect(expired.lines.join("\n")).toContain("sentisense init --new");

    const keepable = describeError(
      new AuthenticationError(`This temporary key has expired, but it can still be kept: open ${KEEP_URL} and sign in.`, 401, "key_expired"),
      false,
      "quote",
    );
    expect(keepable.exitCode).toBe(3);
    expect(keepable.lines.join("\n")).toContain(KEEP_URL);
    expect(keepable.lines.join("\n")).toContain("open the keep link above");
    expect(keepable.lines.join("\n")).not.toContain('run "sentisense init"');
    expectNeutralCopy(keepable.lines.join("\n"));

    const notKept = describeError(new AuthenticationError("Not kept yet.", 403, "key_not_kept"), false, "auth");
    expect(notKept.exitCode).toBe(3);
    expect(notKept.lines.join("\n")).toContain("keep the key");
  });
});
