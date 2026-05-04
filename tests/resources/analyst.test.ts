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

describe("analyst.consensus", () => {
  it("calls GET /api/v1/analyst/{TICKER}/consensus and uppercases ticker", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, previewReason: null, data: {} }));
    await client.analyst.consensus("aapl");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/analyst/AAPL/consensus");
  });
});

describe("analyst.actions", () => {
  it("forwards lookbackDays", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, previewReason: null, data: [] }));
    await client.analyst.actions("AAPL", { lookbackDays: 30 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/analyst/AAPL/actions");
    expect(url).toContain("lookbackDays=30");
  });
});

describe("analyst.estimates", () => {
  it("calls GET /api/v1/analyst/{TICKER}/estimates", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, previewReason: null, data: { estimates: [], surprises: [] } }));
    await client.analyst.estimates("nvda");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/analyst/NVDA/estimates");
  });
});

describe("analyst.marketActivity", () => {
  it("hits /activity with lookbackDays default applied by caller", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, previewReason: null, data: [] }));
    await client.analyst.marketActivity({ lookbackDays: 7 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/analyst/activity");
    expect(url).toContain("lookbackDays=7");
  });
});

describe("insights.latest + range + user", () => {
  it("latest forwards limit and urgency", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, previewReason: null, data: [] }));
    await client.insights.latest({ limit: 25, urgency: "high" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/insights/latest");
    expect(url).toContain("limit=25");
    expect(url).toContain("urgency=high");
  });

  it("stockRange forwards date range", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, previewReason: null, data: [] }));
    await client.insights.stockRange("aapl", { startDate: "2026-04-01", endDate: "2026-04-30" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/insights/stock/AAPL/range");
    expect(url).toContain("startDate=2026-04-01");
    expect(url).toContain("endDate=2026-04-30");
  });

  it("user forwards limit and category", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, previewReason: null, data: [] }));
    await client.insights.user({ limit: 10, category: "INSIDER" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/insights/user");
    expect(url).toContain("limit=10");
    expect(url).toContain("category=INSIDER");
  });
});

describe("stocks.getKpis + institutional.getInstitutionDetail", () => {
  it("getKpis hits /api/v1/stocks/{TICKER}/kpis", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, previewReason: null, data: {} }));
    await client.stocks.getKpis("aapl");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/stocks/AAPL/kpis");
  });

  it("getInstitutionDetail hits /api/v1/institutional/institution/{slug}", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, previewReason: null, data: {} }));
    await client.institutional.getInstitutionDetail("Berkshire-Hathaway");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/institutional/institution/Berkshire-Hathaway");
  });
});

describe("stocks.listKpiCoverage + getKpiTypes ()", () => {
  it("listKpiCoverage hits /api/v1/stocks/with-kpis and parses count + tickers", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      count: 2,
      tickers: [
        { ticker: "AAPL", companyName: "Apple Inc.", lastUpdated: "2026-04-30", kpiCount: 8 },
        { ticker: "TSLA", companyName: "Tesla, Inc.", lastUpdated: "2026-04-15", kpiCount: 6 },
      ],
    }));
    const result = await client.stocks.listKpiCoverage();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/stocks/with-kpis");
    expect(result.count).toBe(2);
    expect(result.tickers[0].ticker).toBe("AAPL");
    expect(result.tickers[0].kpiCount).toBe(8);
  });

  it("getKpiTypes hits /api/v1/stocks/{TICKER}/kpis/types and uppercases ticker", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([
      { id: "iphone_revenue", name: "iPhone Revenue", category: "product_revenue", chartType: "bar" },
      { id: "services_revenue", name: "Services Revenue", category: "segment_revenue", chartType: "line" },
    ]));
    const types = await client.stocks.getKpiTypes("aapl");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/stocks/AAPL/kpis/types");
    expect(types.length).toBe(2);
    expect(types[0].id).toBe("iphone_revenue");
    expect(types[1].chartType).toBe("line");
  });
});
