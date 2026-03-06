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

describe("stocks.list", () => {
  it("calls GET /api/v1/stocks", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(["AAPL", "NVDA"]));
    const result = await client.stocks.list();
    expect(result).toEqual(["AAPL", "NVDA"]);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/v1/stocks");
  });
});

describe("stocks.getPrice", () => {
  it("passes ticker as query param", async () => {
    const mockPrice = { ticker: "AAPL", price: 195.5, change: 2.3, changePercent: 1.19 };
    mockFetch.mockResolvedValueOnce(jsonResponse(mockPrice));
    const result = await client.stocks.getPrice("AAPL");
    expect(result).toEqual(mockPrice);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/stocks/price");
    expect(url).toContain("ticker=AAPL");
  });
});

describe("stocks.getPrices", () => {
  it("joins tickers with comma", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await client.stocks.getPrices(["AAPL", "NVDA", "TSLA"]);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("tickers=AAPL%2CNVDA%2CTSLA");
  });
});

describe("stocks.getProfile", () => {
  it("includes ticker in path", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ticker: "AAPL", name: "Apple" }));
    await client.stocks.getProfile("AAPL");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/stocks/AAPL/profile");
  });
});

describe("stocks.getChart", () => {
  it("passes timeframe option", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ticker: "AAPL", data: [] }));
    await client.stocks.getChart("AAPL", { timeframe: "6M" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("ticker=AAPL");
    expect(url).toContain("timeframe=6M");
  });
});

describe("stocks.getFundamentals", () => {
  it("passes all options as query params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await client.stocks.getFundamentals("AAPL", {
      timeframe: "annual",
      fiscalPeriod: "Q1",
      fiscalYear: 2025,
    });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("ticker=AAPL");
    expect(url).toContain("timeframe=annual");
    expect(url).toContain("fiscalPeriod=Q1");
    expect(url).toContain("fiscalYear=2025");
  });
});

describe("stocks.getMarketStatus", () => {
  it("calls GET /api/v1/stocks/market-status", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ status: "open" }));
    const result = await client.stocks.getMarketStatus();
    expect(result.status).toBe("open");
  });
});

describe("stocks.getImages", () => {
  it("joins tickers and passes forced option", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await client.stocks.getImages(["AAPL", "NVDA"], { forced: true });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("tickers=AAPL%2CNVDA");
    expect(url).toContain("forced=true");
  });
});

describe("stocks.getSimilar", () => {
  it("includes ticker in path and limit in params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.stocks.getSimilar("AAPL", { limit: 3 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/stocks/AAPL/similar");
    expect(url).toContain("limit=3");
  });
});

describe("stocks.getAISummary", () => {
  it("passes depth option", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await client.stocks.getAISummary("AAPL", { depth: "deep" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/stocks/AAPL/ai-summary");
    expect(url).toContain("depth=deep");
  });
});

describe("stocks.getShortInterest", () => {
  it("passes ticker as query param", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await client.stocks.getShortInterest("GME");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("ticker=GME");
  });
});
