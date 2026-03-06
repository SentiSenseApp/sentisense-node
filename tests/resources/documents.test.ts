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
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.documents.getByTicker("AAPL", { source: "news", days: 3 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/documents/ticker/AAPL");
    expect(url).toContain("source=news");
    expect(url).toContain("days=3");
  });
});

describe("documents.getByTickerRange", () => {
  it("passes date range params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
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
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.documents.search("NVDA earnings", { days: 7, limit: 20 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/documents/search");
    expect(url).toContain("query=NVDA+earnings");
    expect(url).toContain("days=7");
    expect(url).toContain("limit=20");
  });
});

describe("documents.getStories", () => {
  it("passes all story options", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.documents.getStories({ limit: 10, expanded: true, days: 3 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/documents/stories");
    expect(url).toContain("limit=10");
    expect(url).toContain("expanded=true");
    expect(url).toContain("days=3");
  });
});

describe("documents.getStory", () => {
  it("includes clusterId in path", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await client.documents.getStory("cluster_abc123");
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
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.documents.getBySource("reddit", { days: 2 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/documents/source/reddit");
    expect(url).toContain("days=2");
  });
});

describe("documents.getTheNews", () => {
  it("calls the-news endpoint", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await client.documents.getTheNews({ limit: 20 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/documents/the-news");
    expect(url).toContain("limit=20");
  });
});
