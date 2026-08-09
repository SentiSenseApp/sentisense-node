import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense from "../../src/index.js";

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

describe("indexes.list", () => {
  it("hits the discovery path", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ indexes: [] }));
    await client.indexes.list();
    expect(mockFetch.mock.calls[0][0] as string).toContain("/api/v1/indexes");
  });

  it("returns every advertised listing, tier and canonical url intact", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        indexes: [
          {
            indexId: "fed-sentiment",
            displayName: "Fed Sentiment",
            description: "Weekly composite.",
            scale: "SENTIMENT",
            accessTier: "free",
            canonicalUrl: "/api/v1/indexes/fed-sentiment",
          },
          {
            indexId: "market-mood",
            displayName: "Market Mood",
            description: "0-100 composite.",
            scale: "PERCENT_0_100",
            accessTier: "free",
            canonicalUrl: "/api/v2/market-mood",
          },
        ],
      }),
    );
    const res = await client.indexes.list();
    expect(res.indexes).toHaveLength(2);
    expect(res.indexes.map((i) => i.indexId)).toEqual(["fed-sentiment", "market-mood"]);
    // Market Mood's canonicalUrl deliberately points at its richer view, not the
    // detail route. A client must not rewrite it to /api/v1/indexes/{id}.
    expect(res.indexes[1].canonicalUrl).toBe("/api/v2/market-mood");
    expect(res.indexes[0].accessTier).toBe("free");
  });
});

describe("indexes.get", () => {
  it("includes the index id in the path", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ indexId: "fed-sentiment" }));
    await client.indexes.get("fed-sentiment");
    expect(mockFetch.mock.calls[0][0] as string).toContain("/api/v1/indexes/fed-sentiment");
  });

  it("keeps a basket index's constituent breakdown", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        indexId: "fed-sentiment",
        displayName: "Fed Sentiment",
        asOf: "2026-06-01",
        value: 0.12,
        scale: "SENTIMENT",
        coverage: 3,
        basketSize: 3,
        totalMentions: 480,
        methodologyNote: "Weekly composite.",
        constituents: [
          {
            kbEntityId: "kb/person/1",
            displayName: "Example",
            role: "Chair",
            weight: 3.0,
            value: 0.15,
            mentionsCount: 260,
            staleness: "FRESH",
            contribution: null,
            link: null,
          },
        ],
      }),
    );
    const snap = await client.indexes.get("fed-sentiment");
    expect(snap.coverage).toBe(3);
    expect(snap.basketSize).toBe(3);
    expect(snap.constituents).not.toBeNull();
    expect(snap.constituents!).toHaveLength(1);
    expect(snap.constituents![0].staleness).toBe("FRESH");
    // Reserved by the API and not populated today; a consumer must tolerate null.
    expect(snap.constituents![0].contribution).toBeNull();
  });

  it("carries a composite index's nulls through untouched", async () => {
    // The whole point of the shared envelope: market-mood is not a basket, so
    // these four are null BY CONSTRUCTION. A client that coerces them to 0 or
    // [] loses the archetype and renders a basket UI for a composite index.
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        indexId: "market-mood",
        displayName: "Market Mood",
        asOf: "2026-08-07",
        value: 66.2,
        scale: "PERCENT_0_100",
        coverage: null,
        basketSize: null,
        totalMentions: null,
        methodologyNote: "Five-signal composite.",
        constituents: null,
      }),
    );
    const snap = await client.indexes.get("market-mood");
    expect(snap.value).toBe(66.2);
    expect(snap.coverage).toBeNull();
    expect(snap.basketSize).toBeNull();
    expect(snap.totalMentions).toBeNull();
    expect(snap.constituents).toBeNull();
    expect(snap.methodologyNote).not.toBe("");
  });
});

describe("indexes.history", () => {
  it("omits days when the caller does not pass one", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ indexId: "fed-sentiment", history: [] }));
    await client.indexes.history("fed-sentiment");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/indexes/fed-sentiment/history");
    expect(url).not.toContain("days=");
  });

  it("passes days through when given", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ indexId: "fed-sentiment", history: [] }));
    await client.indexes.history("fed-sentiment", 30);
    expect(mockFetch.mock.calls[0][0] as string).toContain("days=30");
  });

  it("returns date/value points in order", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        indexId: "fed-sentiment",
        displayName: "Fed Sentiment",
        scale: "SENTIMENT",
        days: 180,
        history: [
          { date: "2026-05-18", value: 0.08 },
          { date: "2026-05-25", value: 0.12 },
        ],
      }),
    );
    const res = await client.indexes.history("fed-sentiment");
    expect(res.history.map((p) => p.date)).toEqual(["2026-05-18", "2026-05-25"]);
    expect(res.history[1].value).toBe(0.12);
    expect(res.days).toBe(180);
  });
});
