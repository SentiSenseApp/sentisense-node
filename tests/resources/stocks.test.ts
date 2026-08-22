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

  it("reads the listing lifecycle fields without a cast", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ticker: "TWTR",
        currentPrice: 54.2,
        change: 0,
        changePercent: 0,
        previousClose: 54.2,
        volume: 0,
        timestamp: 1667174400000,
        listingStatus: "DELISTED",
        delistedDate: "2022-10-27",
        delistingReason: "take_private",
      }),
    );
    const result = await client.stocks.getPrice("TWTR");
    expect(result.listingStatus).toBe("DELISTED");
    expect(result.delistedDate).toBe("2022-10-27");
    expect(result.delistingReason).toBe("take_private");
  });

  it("leaves the listing lifecycle fields undefined for an ordinarily listed stock", async () => {
    // The overwhelming majority of responses omit all three keys.
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ticker: "AAPL", currentPrice: 313.33, timestamp: 1754611200000 }),
    );
    const result = await client.stocks.getPrice("AAPL");
    expect(result.listingStatus).toBeUndefined();
    expect(result.delistedDate).toBeUndefined();
    expect(result.delistingReason).toBeUndefined();
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
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.stocks.getChart("AAPL", { timeframe: "6M" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("ticker=AAPL");
    expect(url).toContain("timeframe=6M");
  });

  it("wraps the bare-array wire response as { ticker, timeframe, data }", async () => {
    const bars = [{ date: "2025-01-02", open: 1, high: 2, low: 1, close: 2, volume: 100 }];
    mockFetch.mockResolvedValueOnce(jsonResponse(bars));
    const result = await client.stocks.getChart("AAPL", { timeframe: "6M" });
    expect(result).toEqual({ ticker: "AAPL", timeframe: "6M", data: bars });
  });

  it("defaults timeframe to 1M when omitted", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    const result = await client.stocks.getChart("AAPL");
    expect(result.timeframe).toBe("1M");
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

  it("drops the deprecated forceRefresh option instead of sending it", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await client.stocks.getAISummary("AAPL", { depth: "deep", forceRefresh: true });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("depth=deep");
    expect(url).not.toContain("forceRefresh");
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

describe("stocks.getQuote", () => {
  it("reads reportedCurrency without a cast", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ticker: "AAPL", currentPrice: 313.33, reportedCurrency: "USD" }),
    );
    const result = await client.stocks.getQuote("AAPL");
    expect(mockFetch.mock.calls[0][0] as string).toContain("/api/v1/stocks/AAPL/quote");
    expect(result.reportedCurrency).toBe("USD");
  });

  it("leaves reportedCurrency undefined when the issuer's currency is unknown", async () => {
    // Live behaviour on an ADR filing in a home currency: the field is omitted, along
    // with the valuation ratios that would mix two currencies. Undefined here must read
    // as "unknown", never as "USD".
    mockFetch.mockResolvedValueOnce(jsonResponse({ ticker: "TSM", currentPrice: 420.04 }));
    const result = await client.stocks.getQuote("TSM");
    expect(result.reportedCurrency).toBeUndefined();
  });
});

describe("stocks.getSentiment", () => {
  it("calls GET /api/v1/stocks/{ticker}/sentiment and returns the envelope", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: false,
        previewReason: null,
        data: {
          ticker: "AAPL",
          sentisenseScore: 41.2,
          direction: "Bullish",
          bySource: [{ source: "news", direction: "Bullish", mentionShare: 0.52, value: 0.31 }],
        },
      }),
    );

    const result = await client.stocks.getSentiment("AAPL");
    const url = mockFetch.mock.calls[0][0] as string;

    expect(url).toContain("/api/v1/stocks/AAPL/sentiment");
    expect(result.isPreview).toBe(false);
    expect(result.data.ticker).toBe("AAPL");
    expect(result.data.bySource?.[0].value).toBe(0.31);
  });

  it("encodes the ticker", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, previewReason: null, data: {} }));
    await client.stocks.getSentiment("BRK B");
    expect(mockFetch.mock.calls[0][0] as string).toContain("BRK%20B");
  });
});

describe("stocks.getOptionsSummary", () => {
  it("calls the per-ticker options summary endpoint and upper-cases the symbol", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, data: { asOf: "2026-08-18" } }),
    );
    const result = await client.stocks.getOptionsSummary("nvda");
    expect(mockFetch.mock.calls[0][0]).toContain("/api/v1/stocks/NVDA/options/summary");
    expect(result.data?.asOf).toBe("2026-08-18");
  });

  it("reads a null data payload as no coverage rather than an error", async () => {
    // An uncovered or unknown ticker answers 200 with a null payload, not a 404.
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, data: null }),
    );
    const result = await client.stocks.getOptionsSummary("ZZZZ");
    expect(result.data).toBeNull();
    expect(result.isPreview).toBe(false);
  });

  it("types the positioning reading as a number and the contract side as a string", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: false,
        previewReason: null,
        data: {
          asOf: "2026-08-18",
          sentiment: -0.42,
          latest: { date: "2026-08-18", callVol: 900000, putVol: 700000, pcVol: 0.78 },
          context: { ivRank1y: 62.1 },
          oiWalls: { expiry: "2026-08-21", maxPain: 175, callWalls: [{ strike: 200, oi: 42100 }] },
          unusual: [{ contract: "NVDA260821C00200000", type: "call", strike: 200, premium: 27500000 }],
        },
      }),
    );
    const result = await client.stocks.getOptionsSummary("NVDA");
    expect(result.data?.sentiment).toBe(-0.42);
    expect(result.data?.latest?.pcVol).toBe(0.78);
    expect(result.data?.context?.ivRank1y).toBe(62.1);
    expect(result.data?.oiWalls?.callWalls?.[0].strike).toBe(200);
    expect(result.data?.unusual?.[0].type).toBe("call");
  });

  it("leaves omitted readings undefined rather than zero", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: true,
        previewReason: "PRO_REQUIRED",
        data: { asOf: "2026-08-18", latest: { date: "2026-08-18" }, context: {} },
      }),
    );
    const result = await client.stocks.getOptionsSummary("NVDA");
    expect(result.data?.latest?.pcVol).toBeUndefined();
    expect(result.data?.context?.ivRank1y).toBeUndefined();
  });
});

describe("stocks.getOptionsHistory", () => {
  it("calls the per-ticker history endpoint and upper-cases the symbol", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: false,
        previewReason: null,
        data: { ticker: "NVDA", window: "1y", series: [{ date: "2025-08-14", atmIv: 0.42 }] },
      }),
    );
    const result = await client.stocks.getOptionsHistory("nvda");
    expect(mockFetch.mock.calls[0][0]).toContain("/api/v1/stocks/NVDA/options/history");
    expect(result.data.series?.[0].atmIv).toBe(0.42);
  });

  it("sends the requested window as a query parameter", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: false,
        previewReason: null,
        data: { ticker: "NVDA", window: "2y", series: [] },
      }),
    );
    await client.stocks.getOptionsHistory("NVDA", { window: "2y" });
    expect(mockFetch.mock.calls[0][0]).toContain("window=2y");
  });

  it("reports no coverage as an empty series, never as a null payload", async () => {
    // The contrast with getOptionsSummary is the whole point: that one answers null for an
    // uncovered ticker, this one answers a populated object with nothing in it. A caller
    // that null-checks here waits for a null that never arrives and reads an empty chart as
    // a live one.
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: false,
        previewReason: null,
        data: { ticker: "ZZZZ", window: "1y", series: [] },
      }),
    );
    const result = await client.stocks.getOptionsHistory("ZZZZ");
    expect(result.data).not.toBeNull();
    expect(result.data.series).toEqual([]);
  });

  it("reports the window actually served, which need not be the one requested", async () => {
    // An unrecognised window clamps to 1y instead of erroring, and a free key is held at 1y
    // whatever it asks for, so the echoed window is the only honest label for a chart axis.
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: false,
        previewReason: null,
        data: { ticker: "NVDA", window: "1y", series: [{ date: "2025-08-14" }] },
      }),
    );
    const result = await client.stocks.getOptionsHistory("NVDA", { window: "5y" });
    expect(result.data.window).toBe("1y");
  });
});
