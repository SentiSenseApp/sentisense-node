import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense from "../../src/index.js";

/**
 * The insights endpoints all go through the server's preview-response builder, so the
 * wire shape is `{ isPreview, previewReason, data }` for every caller. The declared
 * return type is now `PreviewResponse<Insight[]>`, so `result.data` type-checks with no
 * cast: that native access is the regression guard.
 */

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function envelope(data: unknown, isPreview = false, totalCount?: number) {
  const body: Record<string, unknown> = {
    isPreview,
    previewReason: isPreview ? "PRO_REQUIRED" : null,
    data,
  };
  if (totalCount !== undefined) body.totalCount = totalCount;
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const client = new SentiSense({ apiKey: "ssk_test" });

describe("insights.stock", () => {
  it("uppercases the ticker, passes options, and returns the array under data", async () => {
    mockFetch.mockResolvedValueOnce(envelope([{ insightId: "i1" }, { insightId: "i2" }]));
    const result = await client.insights.stock("aapl", { urgency: "high" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/insights/stock/AAPL");
    expect(url).toContain("urgency=high");
    expect(result.isPreview).toBe(false);
    expect(result.data).toHaveLength(2);
  });

  it("surfaces totalCount on a truncated free-tier response", async () => {
    mockFetch.mockResolvedValueOnce(envelope([{ insightId: "i1" }], true, 12));
    const result = await client.insights.stock("AAPL");
    expect(result.isPreview).toBe(true);
    expect(result.previewReason).toBe("PRO_REQUIRED");
    expect(result.data).toHaveLength(1);
    expect(result.totalCount).toBe(12);
  });
});

describe("insights.stockRange", () => {
  it("passes the date range", async () => {
    mockFetch.mockResolvedValueOnce(envelope([]));
    await client.insights.stockRange("NVDA", {
      startDate: "2026-07-01",
      endDate: "2026-07-23",
    });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/insights/stock/NVDA/range");
    expect(url).toContain("startDate=2026-07-01");
    expect(url).toContain("endDate=2026-07-23");
  });
});

describe("insights.market", () => {
  it("returns the envelope, not a bare array", async () => {
    mockFetch.mockResolvedValueOnce(envelope([{ insightId: "m1" }]));
    const result = await client.insights.market();
    expect(mockFetch.mock.calls[0][0]).toContain("/api/v1/insights/market");
    expect(result.data).toHaveLength(1);
    // Guards the regression: iterating the response itself used to be the documented
    // pattern and throws, because the response is an object.
    expect(Array.isArray(result)).toBe(false);
  });
});

describe("insights.latest", () => {
  it("passes limit and urgency", async () => {
    mockFetch.mockResolvedValueOnce(envelope([]));
    await client.insights.latest({ limit: 5, urgency: "medium" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/insights/latest");
    expect(url).toContain("limit=5");
    expect(url).toContain("urgency=medium");
  });
});

describe("insights.user", () => {
  it("passes limit and category", async () => {
    mockFetch.mockResolvedValueOnce(envelope([]));
    await client.insights.user({ limit: 3, category: "earnings" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/insights/user");
    expect(url).toContain("limit=3");
    expect(url).toContain("category=earnings");
  });
});

describe("insights.types", () => {
  it("returns a bare string array, with no envelope", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(["sentiment_shift", "options_activity"]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const result = await client.insights.types("aapl");
    expect(mockFetch.mock.calls[0][0]).toContain("/api/v1/insights/stock/AAPL/types");
    expect(result).toEqual(["sentiment_shift", "options_activity"]);
  });
});
