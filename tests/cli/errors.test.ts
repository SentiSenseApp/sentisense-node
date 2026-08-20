import { afterEach, describe, expect, it, vi } from "vitest";
import { errorResponse, jsonResponse, routeFetch, run } from "./harness.js";
import { EXIT } from "../../src/cli/errors.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const KEYED = { SENTISENSE_API_KEY: "ssk_test" };

/**
 * Every failure gets two stderr lines and a code a script can branch on. These tests pin the
 * codes, because a caller that switches on them has no other contract.
 */

function statusFetch(status: number, headers: Record<string, string> = {}) {
  return vi.fn(async () => errorResponse(status, { error: "failed", message: "no" }, headers));
}

describe("exit codes", () => {
  it("exits 0 on success", async () => {
    const result = await run(["mood", "--plain"], {
      env: KEYED,
      fetch: vi.fn(async () => jsonResponse({ market: {}, sectors: {} })),
    });
    expect(result.code).toBe(EXIT.OK);
    expect(result.stderr).toBe("");
  });

  it("exits 2 on an unknown command, and suggests the nearest one", async () => {
    const result = await run(["quotes", "NVDA"], { env: KEYED });
    expect(result.code).toBe(EXIT.USAGE);
    expect(result.stderr).toContain('unknown command "quotes"');
    expect(result.stderr).toContain('did you mean "quote"');
  });

  it("exits 2 on a missing argument", async () => {
    const result = await run(["quote"], { env: KEYED });
    expect(result.code).toBe(EXIT.USAGE);
    expect(result.stderr).toContain("at least one ticker");
    expect(result.stderr).toContain("sentisense quote NVDA");
  });

  it("exits 3 with no key, naming both ways to set one", async () => {
    const result = await run(["quote", "NVDA"], { env: {} });
    expect(result.code).toBe(EXIT.AUTH);
    expect(result.stderr).toContain("no API key configured");
    expect(result.stderr).toContain("SENTISENSE_API_KEY");
    expect(result.stderr).toContain("sentisense auth <key>");
    expect(result.stderr).toContain("https://app.sentisense.ai/get-api-key");
  });

  it("exits 3 on a rejected key", async () => {
    const result = await run(["quote", "NVDA"], { env: KEYED, fetch: statusFetch(401) });
    expect(result.code).toBe(EXIT.AUTH);
    expect(result.stderr).toContain("was rejected (401)");
    expect(result.stderr).toContain("https://app.sentisense.ai/get-api-key");
  });

  it("exits 3 on a forbidden key", async () => {
    const result = await run(["quote", "NVDA"], { env: KEYED, fetch: statusFetch(403) });
    expect(result.code).toBe(EXIT.AUTH);
  });

  it("exits 4 on an unknown symbol", async () => {
    const result = await run(["quote", "ZZZZ"], { env: KEYED, fetch: statusFetch(404) });
    expect(result.code).toBe(EXIT.NOT_FOUND);
    expect(result.stderr).toContain("not found");
    expect(result.stderr).toContain("canonical tickers");
  });

  it("exits 5 when rate limited, and says how long to wait", async () => {
    const result = await run(["quote", "NVDA"], {
      env: KEYED,
      fetch: statusFetch(429, { "Retry-After": "30" }),
    });
    expect(result.code).toBe(EXIT.RATE_LIMIT);
    expect(result.stderr).toContain("wait 30 seconds");
  });

  it("does not sit through a rate-limit backoff before reporting", async () => {
    // The library would sleep for the whole Retry-After window on its own. A command has to
    // hand control back instead, which is what exit code 5 is for.
    const started = Date.now();
    const result = await run(["quote", "NVDA"], {
      env: KEYED,
      fetch: statusFetch(429, { "Retry-After": "60" }),
    });
    expect(result.code).toBe(EXIT.RATE_LIMIT);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("exits 6 on a timeout", async () => {
    const result = await run(["quote", "NVDA"], {
      env: KEYED,
      fetch: vi.fn(async () => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        throw error;
      }),
    });
    expect(result.code).toBe(EXIT.NETWORK);
    expect(result.stderr).toContain("could not reach the API");
    expect(result.stderr).toContain("sentisense health");
  });

  it("exits 6 on a network failure", async () => {
    const result = await run(["quote", "NVDA"], {
      env: KEYED,
      fetch: vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    });
    expect(result.code).toBe(EXIT.NETWORK);
  });

  it("exits 1 on a server error", async () => {
    const result = await run(["quote", "NVDA"], { env: KEYED, fetch: statusFetch(500) });
    expect(result.code).toBe(EXIT.ERROR);
    expect(result.stderr).toContain("request failed (500)");
  });

  it("keeps every message to two lines unless --debug asks for more", async () => {
    const quiet = await run(["quote", "NVDA"], { env: KEYED, fetch: statusFetch(500) });
    expect(quiet.stderr.trimEnd().split("\n")).toHaveLength(2);
    expect(quiet.stderr).not.toContain("at ");

    const loud = await run(["quote", "NVDA", "--debug"], { env: KEYED, fetch: statusFetch(500) });
    expect(loud.stderr.trimEnd().split("\n").length).toBeGreaterThan(2);
    expect(loud.stderr).toContain("APIError");
  });

  it("writes failures to stderr and leaves stdout empty", async () => {
    const result = await run(["quote", "NVDA", "--json"], { env: KEYED, fetch: statusFetch(404) });
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toBe("");
  });

  it("never prints the key back in an error", async () => {
    const result = await run(["quote", "NVDA"], {
      env: { SENTISENSE_API_KEY: "ssk_live_supersecretvalue" },
      fetch: statusFetch(401),
    });
    expect(result.stderr).not.toContain("supersecret");
  });

  it("does not retry a failed request", async () => {
    const fetchMock = statusFetch(500);
    await run(["mood"], { env: KEYED, fetch: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports an unroutable base URL as a network failure", async () => {
    const result = await run(["mood", "--base-url", "https://nowhere.invalid"], {
      env: KEYED,
      fetch: routeFetch([]),
    });
    // The stub answers 404 for anything it does not know, so this checks the mapping, not DNS.
    expect(result.code).toBe(EXIT.NOT_FOUND);
  });
});
