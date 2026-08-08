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

describe("documents.getByTicker", () => {
  it("includes ticker in path and passes options", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ documents: [], totalCount: 0, searchTicker: null, source: "ALL", startDate: "2026-01-01", endDate: "2026-01-02" }));
    await client.documents.getByTicker("AAPL", { source: "news", days: 3 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/documents/ticker/AAPL");
    expect(url).toContain("source=news");
    expect(url).toContain("days=3");
  });
});

describe("documents.getByTickerRange", () => {
  it("passes date range params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ documents: [], totalCount: 0, searchTicker: null, source: "ALL", startDate: "2026-01-01", endDate: "2026-01-02" }));
    await client.documents.getByTickerRange("AAPL", {
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      source: "reddit",
    });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/documents/ticker/AAPL/range");
    expect(url).toContain("startDate=2025-01-01");
    expect(url).toContain("endDate=2025-01-31");
    expect(url).toContain("source=reddit");
  });
});

describe("documents.search", () => {
  it("passes query and options", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ documents: [], totalCount: 0, searchTicker: null, source: "ALL", startDate: "2026-01-01", endDate: "2026-01-02" }));
    await client.documents.search("NVDA earnings", { days: 7, limit: 20 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/documents/search");
    expect(url).toContain("query=NVDA+earnings");
    expect(url).toContain("days=7");
    expect(url).toContain("limit=20");
  });
});

describe("Document.sourceName", () => {
  it("carries the publisher on news and null on social sources", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        documents: [
          { id: "1", url: "https://example.com/a", source: "NEWS", sourceName: "The Motley Fool", published: 1786211955, averageSentiment: 0.2, reliability: 0.9, sentiment: [] },
          { id: "2", url: "https://example.com/b", source: "REDDIT", sourceName: null, published: 1786211955, averageSentiment: 0, reliability: 0.5, sentiment: [] },
        ],
        totalCount: 2,
        searchTicker: null,
        source: "ALL",
        startDate: "2026-08-01",
        endDate: "2026-08-08",
      }),
    );
    const result = await client.documents.search("NVDA earnings");
    expect(result.documents[0].sourceName).toBe("The Motley Fool");
    // Null on social, so a label has to fall back to `source`.
    expect(result.documents[1].sourceName).toBeNull();
    expect(result.documents[1].sourceName ?? result.documents[1].source).toBe("REDDIT");
  });
});

describe("documents.getStories", () => {
  it("passes all story options", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.documents.getStories({ limit: 10, days: 3, offset: 5, filterHours: 48 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/documents/stories");
    expect(url).toContain("limit=10");
    expect(url).toContain("days=3");
    expect(url).toContain("offset=5");
    expect(url).toContain("filterHours=48");
  });
});

describe("documents.getStoryDetail", () => {
  it("includes clusterId in path", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await client.documents.getStoryDetail("cluster_abc123");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/documents/stories/cluster_abc123");
  });
});

describe("documents.getStoriesByTicker", () => {
  it("includes ticker in path", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.documents.getStoriesByTicker("AAPL", { limit: 5 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/documents/stories/ticker/AAPL");
    expect(url).toContain("limit=5");
  });
});

describe("documents.getBySource", () => {
  it("includes source in path", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ documents: [], totalCount: 0, searchTicker: null, source: "ALL", startDate: "2026-01-01", endDate: "2026-01-02" }));
    await client.documents.getBySource("reddit", { days: 2 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/documents/source/reddit");
    expect(url).toContain("days=2");
  });

  it("passes the sort option through", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ documents: [], totalCount: 0, searchTicker: null, source: "ALL", startDate: "2026-01-01", endDate: "2026-01-02" }));
    await client.documents.getBySource("news", { hours: 6, limit: 50, sort: "top" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/documents/source/news");
    expect(url).toContain("hours=6");
    expect(url).toContain("limit=50");
    expect(url).toContain("sort=top");
  });
});


