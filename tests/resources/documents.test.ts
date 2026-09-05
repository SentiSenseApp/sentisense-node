import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense from "../../src/index.js";
import type { StoryCluster, StoryTimelineEntry } from "../../src/index.js";

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

describe("story provenance fields", () => {
  const cluster = {
    id: "cluster_abc123",
    title: "Chipmaker lifts full-year outlook after a beat",
    clusterSize: 7,
    averageSentiment: 0.42,
    clusteredAt: 1757001600,
    storySource: "ORIGINAL" as const,
    isLive: true,
  };

  const story = {
    cluster,
    displayTickers: ["Example Corp (EXMP)"],
    tickers: ["EXMP"],
    primaryEntityNames: ["Example Corp"],
    impactScore: 0.81,
    brokeAt: 1757000400,
  };

  it("reads storySource and isLive off the cluster", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([story]));
    const stories = await client.documents.getStories({ limit: 1 });
    expect(stories[0].cluster.storySource).toBe("ORIGINAL");
    expect(stories[0].cluster.isLive).toBe(true);
  });

  it("leaves both undefined when the API build predates them", async () => {
    // Undefined has to survive as "not known": collapsing it to "AI"/false would make
    // an Original look pipeline-written and an unsettled story look settled.
    const { storySource: _s, isLive: _l, ...older } = cluster;
    mockFetch.mockResolvedValueOnce(jsonResponse([{ ...story, cluster: older }]));
    const stories = await client.documents.getStories({ limit: 1 });
    expect(stories[0].cluster.storySource).toBeUndefined();
    expect(stories[0].cluster.isLive).toBeUndefined();
    // Still a valid StoryCluster: both fields are optional, gated by npm run typecheck.
    const narrowed: StoryCluster = stories[0].cluster;
    expect(narrowed.id).toBe("cluster_abc123");
  });

  it("types the story detail timeline for callers that narrow it", async () => {
    const timeline: StoryTimelineEntry[] = [
      { publishedAt: 1757005200000, updateType: "UPDATE", content: "Shares pared gains." },
      { publishedAt: 1757001600000, updateType: "INITIAL", content: "The print landed." },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse({ ...cluster, timeline }));
    const detail = (await client.documents.getStoryDetail("cluster_abc123")) as {
      timeline: StoryTimelineEntry[];
    };
    expect(detail.timeline).toHaveLength(2);
    // Newest first, as served.
    expect(detail.timeline[0].publishedAt).toBeGreaterThan(detail.timeline[1].publishedAt);
    expect(detail.timeline[1].updateType).toBe("INITIAL");
    // updateType is left open: an unrecognised label is served through, not rejected.
    const unknownLabel: StoryTimelineEntry = {
      publishedAt: 1757008800000,
      updateType: "RETRACTION",
      content: "Pulled pending review.",
    };
    expect(unknownLabel.updateType).toBe("RETRACTION");
  });

  it("returns an empty timeline for a story with no updates", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ...cluster, timeline: [] }));
    const detail = (await client.documents.getStoryDetail("cluster_abc123")) as {
      timeline: StoryTimelineEntry[];
    };
    expect(detail.timeline).toEqual([]);
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


