import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import SentiSense, {
  type FundamentalsHistory,
  type FundamentalsLineSource,
} from "../../src/index.js";

const mockFetch = vi.fn();
const client = new SentiSense({ apiKey: "ssk_test" });

beforeEach(() => vi.stubGlobal("fetch", mockFetch));
afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

function respond(payload: unknown) {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function requestedUrl(): URL {
  return new URL(String(mockFetch.mock.calls[0][0]));
}

// Synthetic values in the live shape: one period served from an SEC-backed record, carrying
// the four provenance fields, and one served from the data provider, carrying none of them.
const SEC_PERIOD = {
  ticker: "EXMP",
  fiscalPeriod: "Q3",
  fiscalYear: "2026",
  periodEndDate: "2026-09-30",
  periodMonths: 3,
  filingDate: "2026-11-04",
  revenue: 17600000000,
  capitalExpenditure: -580000000,
  reportedCurrency: "USD",
  fetchedAt: 1794600000,
  dataSource: "",
  source: "SEC",
  sourceRef: "0000000001-26-000057",
  secFiled: "2026-11-04",
  lineSources: {
    revenue: { source: "SEC", accession: "0000000001-26-000057", filed: "2026-11-04" },
    capitalExpenditure: { source: "SEC", accession: "0000000001-26-000057", filed: "2026-11-04" },
  },
};

const PROVIDER_PERIOD = {
  ticker: "EXMP",
  fiscalPeriod: "Q2",
  fiscalYear: "2026",
  periodEndDate: "2026-06-30",
  periodMonths: 3,
  filingDate: "2026-08-05",
  revenue: 16500000000,
  reportedCurrency: "USD",
  fetchedAt: 1794600000,
  dataSource: "",
};

describe("stocks.getFundamentalsHistory", () => {
  it("calls the history endpoint with the ticker and options", async () => {
    respond({ ticker: "EXMP", timeframe: "annual", count: 0, dataSource: "", reason: null, periods: [] });
    await client.stocks.getFundamentalsHistory("EXMP", { timeframe: "annual", limit: 10 });
    const url = requestedUrl();
    expect(url.pathname).toBe("/api/v1/stocks/fundamentals/history");
    expect(url.searchParams.get("ticker")).toBe("EXMP");
    expect(url.searchParams.get("timeframe")).toBe("annual");
    expect(url.searchParams.get("limit")).toBe("10");
  });

  it("sends only the ticker when no options are given", async () => {
    respond({ ticker: "EXMP", timeframe: "quarterly", count: 0, dataSource: "", reason: null, periods: [] });
    await client.stocks.getFundamentalsHistory("EXMP");
    expect([...requestedUrl().searchParams.keys()]).toEqual(["ticker"]);
  });

  it("reads the provenance fields where present and finds them absent elsewhere", async () => {
    respond({
      ticker: "EXMP",
      timeframe: "quarterly",
      count: 2,
      dataSource: "",
      reason: null,
      periods: [SEC_PERIOD, PROVIDER_PERIOD],
    });
    const history = await client.stocks.getFundamentalsHistory("EXMP", { limit: 2 });
    expectTypeOf(history).toEqualTypeOf<FundamentalsHistory>();
    expect(history.count).toBe(2);

    const [sec, provider] = history.periods;
    expect(sec.source).toBe("SEC");
    expect(sec.sourceRef).toBe("0000000001-26-000057");
    expect(sec.secFiled).toBe("2026-11-04");
    expectTypeOf(sec.lineSources).toEqualTypeOf<Record<string, FundamentalsLineSource> | undefined>();
    expect(sec.lineSources?.revenue).toEqual({
      source: "SEC",
      accession: "0000000001-26-000057",
      filed: "2026-11-04",
    });
    expect(sec.capitalExpenditure).toBe(-580000000);

    // Absent, not null, on a period that does not come from an SEC-backed record.
    for (const key of ["source", "sourceRef", "secFiled", "lineSources"]) {
      expect(Object.prototype.hasOwnProperty.call(provider, key)).toBe(false);
    }
    expect(provider.source).toBeUndefined();
    expect(provider.lineSources).toBeUndefined();
  });

  it("resolves an empty history with its reason rather than throwing", async () => {
    respond({
      ticker: "ZZZQ",
      timeframe: "quarterly",
      count: 0,
      dataSource: null,
      reason: "No statements available for this ticker.",
      periods: [],
    });
    const history = await client.stocks.getFundamentalsHistory("ZZZQ");
    expect(history.periods).toEqual([]);
    expect(history.reason).toBe("No statements available for this ticker.");
  });

  it("types the provenance fields on getFundamentals too, the same period object", async () => {
    respond({ ...SEC_PERIOD, timeframe: "quarterly" });
    const period = await client.stocks.getFundamentals("EXMP");
    expect(period.lineSources?.capitalExpenditure?.accession).toBe("0000000001-26-000057");
  });
});
