import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense, { APIError, type EtfQuote } from "../../src/index.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Real responses captured from the live API. SPY was taken during regular hours, so it
// carries no `extendedHours` and no `priceAsOf`; QQQ was taken after the close and carries
// the after-hours view.
function fixture(name: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8"),
  );
}

// Checked against the interface by the type checker: `satisfies` rejects a missing or an
// extra key, so a wire key that is not in this list is a key the interface does not declare.
const ETF_QUOTE_KEYS = {
  ticker: true, currentPrice: true, change: true, changePercent: true, volume: true,
  open: true, dayHigh: true, dayLow: true, previousClose: true, week52High: true,
  week52Low: true, dividendYield: true, aum: true, expenseRatio: true, nav: true,
  inceptionDate: true, timestamp: true, priceAsOf: true, extendedHours: true,
} satisfies Record<keyof EtfQuote, true>;

const client = new SentiSense({ apiKey: "ssk_test" });

describe("etfs.quote", () => {
  it("calls GET /api/v1/etfs/{TICKER}/quote with the ticker upper-cased", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(fixture("etf_quote_spy_live.json")));
    await client.etfs.quote("spy");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/etfs/SPY/quote");
    expect(url).not.toContain("/private/");
  });

  it("reads the fund facts without a cast", async () => {
    const wire = fixture("etf_quote_spy_live.json");
    mockFetch.mockResolvedValueOnce(jsonResponse(wire));
    const quote: EtfQuote = await client.etfs.quote("SPY");
    expect(quote.ticker).toBe("SPY");
    expect(quote.aum).toBe(818687280000);
    // Fractions, not percentage points.
    expect(quote.expenseRatio).toBe(0.0009);
    expect(quote.dividendYield).toBeLessThan(1);
    expect(quote.inceptionDate).toBe("1993-01-22");
    // Epoch milliseconds.
    expect(String(quote.timestamp)).toHaveLength(13);
    // Unknown fields are omitted, not sent as null.
    expect("extendedHours" in quote).toBe(false);
    expect("priceAsOf" in quote).toBe(false);
  });

  it("parses the nested after-hours view", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(fixture("etf_quote_qqq_live.json")));
    const quote = await client.etfs.quote("QQQ");
    expect(quote.extendedHours?.session).toBe("post");
    expect(quote.extendedHours?.price).toBe(742.8);
    expect(typeof quote.extendedHours?.changePercent).toBe("number");
  });

  it("declares every field the live responses carry", () => {
    for (const name of ["etf_quote_spy_live.json", "etf_quote_qqq_live.json"]) {
      const wire = fixture(name);
      expect(Object.keys(wire).filter((k) => !(k in ETF_QUOTE_KEYS))).toEqual([]);
    }
  });

  it("surfaces the stock refusal as an APIError with its code", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        { error: "ticker_is_not_etf", message: "AAPL is not an ETF; use /api/v1/stocks/AAPL/quote" },
        400,
      ),
    );
    const error = await client.etfs.quote("AAPL").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).code).toBe("ticker_is_not_etf");
  });
});
