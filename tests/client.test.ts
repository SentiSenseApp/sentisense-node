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

    await expect(c.stocks.getChart({ ticker: "AAPL", timeframe: "MAX" })).rejects.toMatchObject({
      retryAfter: 30,
    });
  });

  it("falls back rather than yielding NaN when Retry-After is an HTTP-date", async () => {
    const c = new SentiSense({ apiKey: "ssk_test", maxRetries: 0 });
    mockFetch.mockResolvedValueOnce(acceptedResponse("Wed, 21 Oct 2026 07:28:00 GMT"));

    await expect(c.stocks.getChart({ ticker: "AAPL", timeframe: "MAX" })).rejects.toMatchObject({
      retryAfter: 3,
    });
  });
});
