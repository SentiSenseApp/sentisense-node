import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense from "../../src/index.js";
import type { MarketMoodOptions } from "../../src/index.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const client = new SentiSense({ apiKey: "ssk_test" });

function requestedUrl(): URL {
  return new URL(mockFetch.mock.calls[0][0] as string);
}

describe("marketMood.get", () => {
  it("sends days when asked, so the history length is honoured", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ market: { currentScore: 59.1 } }));
    await client.marketMood.get({ days: 30 });
    const url = requestedUrl();
    expect(url.pathname).toBe("/api/v2/market-mood");
    expect(url.searchParams.get("days")).toBe("30");
  });

  it("sends no query string without options, leaving the API default in charge", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await client.marketMood.get();
    const url = requestedUrl();
    expect(url.pathname).toBe("/api/v2/market-mood");
    expect(url.search).toBe("");
  });

  it("treats an empty options object like no options", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await client.marketMood.get({});
    expect(requestedUrl().search).toBe("");
  });

  it("still accepts a plain-JS null, which older callers could pass harmlessly", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await client.marketMood.get(null as unknown as MarketMoodOptions);
    expect(requestedUrl().search).toBe("");
  });

  it("sends days=0 as given, leaving validation to the API", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    const options: MarketMoodOptions = { days: 0 };
    await client.marketMood.get(options);
    expect(requestedUrl().searchParams.get("days")).toBe("0");
  });

  it("omits days when it is explicitly undefined", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await client.marketMood.get({ days: undefined });
    expect(requestedUrl().search).toBe("");
  });

  it("still type-checks and runs as a bound callback, as the no-argument get did", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    // A plain-JS or callback caller can hand get() a non-options value; it is ignored as before.
    await Promise.resolve(30).then(client.marketMood.get.bind(client.marketMood));
    expect(requestedUrl().search).toBe("");
  });

  it("returns the payload untouched", async () => {
    const payload = { market: { currentScore: 59.1, phase: "Optimism" }, history: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(payload));
    await expect(client.marketMood.get({ days: 7 })).resolves.toEqual(payload);
  });
});
