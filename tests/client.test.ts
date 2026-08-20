import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense, {
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  APIError,
  SentiSenseError,
} from "../src/index.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(
  status: number,
  body: { error?: string; message?: string } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("SentiSense client", () => {
  it("constructs with defaults", () => {
    const client = new SentiSense();
    expect(client).toBeDefined();
    expect(client.stocks).toBeDefined();
    expect(client.documents).toBeDefined();
    expect(client.institutional).toBeDefined();
    expect(client.entityMetrics).toBeDefined();
    expect(client.marketMood).toBeDefined();
    expect(client.kb).toBeDefined();
  });

  it("sets API key header", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(["AAPL"]));

    const client = new SentiSense({ apiKey: "ssk_test_123" });
    await client.stocks.list();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-SentiSense-API-Key"]).toBe("ssk_test_123");
  });

  it("omits API key header when not provided", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(["AAPL"]));

    const client = new SentiSense();
    await client.stocks.list();

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-SentiSense-API-Key"]).toBeUndefined();
  });

  it("uses custom base URL", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(["AAPL"]));

    const client = new SentiSense({ baseUrl: "https://custom.example.com/" });
    await client.stocks.list();

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("https://custom.example.com/api/v1/stocks");
  });

  it("sets User-Agent header in Node.js", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(["AAPL"]));

    const client = new SentiSense();
    await client.stocks.list();

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["User-Agent"]).toMatch(/^sentisense-node\//);
  });

  it("appends userAgentSuffix to the User-Agent", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(["AAPL"]));

    const client = new SentiSense({ userAgentSuffix: "my-bot/1.4 agent/research-desk" });
    await client.stocks.list();

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["User-Agent"]).toMatch(
      /^sentisense-node\/\d+\.\d+\.\d+ my-bot\/1\.4 agent\/research-desk$/,
    );
  });

  it("appends userAgentSuffix on POST requests too", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ results: [], matched: 0, limit: 100 }));

    const client = new SentiSense({ userAgentSuffix: "my-bot/1.4" });
    await client.screener.run({ plan: { filters: [] } });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["User-Agent"]).toContain(" my-bot/1.4");
  });

  it("ignores an empty userAgentSuffix", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(["AAPL"]));

    const client = new SentiSense({ userAgentSuffix: "   " });
    await client.stocks.list();

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["User-Agent"]).toMatch(/^sentisense-node\/\d+\.\d+\.\d+$/);
  });

  it("collapses newlines in userAgentSuffix so it cannot end the header block", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(["AAPL"]));

    const client = new SentiSense({ userAgentSuffix: "my-bot/1.4\r\nX-Injected: yes" });
    await client.stocks.list();

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["User-Agent"]).toBe(
      init.headers["User-Agent"].replace(/[\r\n]/g, ""),
    );
    expect(init.headers["User-Agent"]).toContain("my-bot/1.4 X-Injected: yes");
  });
});

describe("error handling", () => {
  it("throws AuthenticationError on 401", async () => {
    mockFetch.mockResolvedValueOnce(
      errorResponse(401, { error: "invalid_api_key", message: "Invalid API key" }),
    );

    const client = new SentiSense({ apiKey: "bad_key" });
    await expect(client.stocks.list()).rejects.toThrow(AuthenticationError);
  });

  it("throws AuthenticationError on 403", async () => {
    mockFetch.mockResolvedValueOnce(
      errorResponse(403, { error: "api_access_disabled", message: "PRO required" }),
    );

    const client = new SentiSense({ apiKey: "ssk_free" });
    await expect(client.stocks.getAISummary("AAPL")).rejects.toThrow(AuthenticationError);
  });

  it("throws NotFoundError on 404", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404, { message: "Not found" }));

    const client = new SentiSense();
    await expect(client.stocks.getProfile("INVALID")).rejects.toThrow(NotFoundError);
  });

  it("throws RateLimitError on 429", async () => {
    mockFetch.mockResolvedValueOnce(
      errorResponse(429, { error: "quota_exceeded", message: "Rate limit exceeded" }),
    );

    const client = new SentiSense({ apiKey: "ssk_test", maxRetries: 0 });
    await expect(client.stocks.list()).rejects.toThrow(RateLimitError);
  });

  it("throws APIError on other errors", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500, { message: "Internal error" }));

    const client = new SentiSense({ maxRetries: 0 });
    await expect(client.stocks.list()).rejects.toThrow(APIError);
  });

  it("includes status and code on error", async () => {
    mockFetch.mockResolvedValueOnce(
      errorResponse(429, { error: "quota_exceeded", message: "Slow down" }),
    );

    const client = new SentiSense({ maxRetries: 0 });
    try {
      await client.stocks.list();
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitError);
      const err = e as RateLimitError;
      expect(err.status).toBe(429);
      expect(err.code).toBe("quota_exceeded");
      expect(err.message).toBe("Slow down");
    }
  });

  it("throws SentiSenseError on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

    const client = new SentiSense();
    await expect(client.stocks.list()).rejects.toThrow(SentiSenseError);
  });

  it("throws SentiSenseError on timeout", async () => {
    mockFetch.mockImplementationOnce(
      () => new Promise((_, reject) => {
        setTimeout(() => reject(new DOMException("Aborted", "AbortError")), 10);
      }),
    );

    const client = new SentiSense({ timeout: 1 });
    await expect(client.stocks.list()).rejects.toThrow(SentiSenseError);
  });
});

describe("Retry-After handling", () => {
  // `Retry-After` is vendor- and attacker-controlled. A huge value used to strand the
  // caller for its full duration, and an HTTP-date (legal per RFC) parsed to NaN, which
  // compared false against every threshold and retried instantly in a busy loop.

  function acceptedResponse(retryAfter?: string): Response {
    return new Response(null, {
      status: 202,
      headers: retryAfter ? { "Retry-After": retryAfter } : {},
    });
  }

  it("caps an oversized Retry-After on a deep-history 202", async () => {
    const c = new SentiSense({ apiKey: "ssk_test", maxRetries: 0 });
    mockFetch.mockResolvedValueOnce(acceptedResponse("86400"));

    await expect(c.stocks.getChart("AAPL", { timeframe: "MAX" })).rejects.toMatchObject({
      retryAfter: 30,
    });
  });

  it("falls back rather than yielding NaN when Retry-After is an HTTP-date", async () => {
    const c = new SentiSense({ apiKey: "ssk_test", maxRetries: 0 });
    mockFetch.mockResolvedValueOnce(acceptedResponse("Wed, 21 Oct 2026 07:28:00 GMT"));

    await expect(c.stocks.getChart("AAPL", { timeframe: "MAX" })).rejects.toMatchObject({
      retryAfter: 3,
    });
  });
});

describe("RateLimitError.retryAfter", () => {
  // The same header hostility as above, but on the value handed to the caller. The 202
  // path clamped it and the 429 path did not, so `error.retryAfter` could surface a raw
  // 86400 or a NaN: `setTimeout(fn, NaN)` fires on the next tick, turning a caller's
  // polite backoff into a hot loop against an endpoint that just asked it to stop.

  function limited(retryAfter?: string): Response {
    return new Response(JSON.stringify({ error: "quota_exceeded", message: "Slow down" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        ...(retryAfter ? { "Retry-After": retryAfter } : {}),
      },
    });
  }

  async function retryAfterOf(header?: string): Promise<number | undefined> {
    const c = new SentiSense({ apiKey: "ssk_test", maxRetries: 0 });
    mockFetch.mockResolvedValueOnce(limited(header));
    try {
      await c.stocks.list();
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitError);
      return (e as RateLimitError).retryAfter;
    }
  }

  it("passes a sane value through unchanged", async () => {
    expect(await retryAfterOf("12")).toBe(12);
  });

  it("caps an oversized value at the rate-limit ceiling", async () => {
    expect(await retryAfterOf("86400")).toBe(120);
  });

  it("raises a zero to the floor, so a retry is never instant", async () => {
    expect(await retryAfterOf("0")).toBe(0.5);
  });

  it("is undefined, never NaN, when Retry-After is an HTTP-date", async () => {
    const value = await retryAfterOf("Wed, 21 Oct 2026 07:28:00 GMT");
    expect(value).toBeUndefined();
    expect(Number.isNaN(value as number)).toBe(false);
  });

  it("is undefined when the server sends no Retry-After at all", async () => {
    expect(await retryAfterOf()).toBeUndefined();
  });
});
