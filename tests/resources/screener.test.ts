import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense from "../../src/index.js";

/**
 * Three contracts are gated here because getting any of them wrong produces a
 * screen that runs cleanly and answers the wrong question:
 *
 * - `limit` rides next to `plan` on the request body, never inside it. A plan
 *   is a stored object; paging is a transport concern. A `limit` nested in the
 *   plan is silently ignored and the caller gets the 100-row default.
 * - `matched` is the pre-limit count, so truncation stays visible. A capped
 *   list with no count is how a caller concludes the universe is smaller than
 *   it is.
 * - Omitting `tickers` means the whole tracked universe, so the key must be
 *   absent from the body rather than sent as `null`.
 */

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

function requestBody(callIndex = 0): any {
  return JSON.parse(mockFetch.mock.calls[callIndex][1].body as string);
}

const client = new SentiSense({ apiKey: "ssk_test" });

const EXECUTE_PAYLOAD = {
  matched: 41,
  limit: 2,
  results: [
    {
      ticker: "AAPL",
      sentiSenseScore7D: 14.2,
      sentiSenseScore1M: 9.8,
      scoreChange7D: 4.4,
      sentimentDirection: 1,
      analystRatingMean: 1.9,
      maCrossState: 1,
      marketCap: 3120000000000,
      return1Y: null,
      sentisenseScoreBars7D: [11.0, 12.5],
      lastUpdated: 1754000000,
    },
    { ticker: "MSFT", sentiSenseScore7D: 11.1 },
  ],
};

describe("screener.fields", () => {
  it("hits the catalog path", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ stock: [], etf: [] }));
    await client.screener.fields();
    expect(mockFetch.mock.calls[0][0] as string).toContain("/api/v1/screener/fields");
  });

  it("keeps ENUM options and live STRING values intact", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        stock: [
          {
            name: "SENTI_SCORE_7D",
            label: "SentiSense 7D",
            group: "Sentiment",
            type: "NUMBER",
            unit: "SCORE",
            ops: ["GTE", "GT", "LTE", "LT"],
            sortable: true,
            step: 1,
            placeholder: "13",
            description: "7-day SentiSense score.",
            options: null,
            quickValues: ["5", "13", "23"],
            values: null,
          },
          {
            name: "SENTIMENT_DIRECTION",
            label: "Score Direction",
            group: "Sentiment",
            type: "ENUM",
            unit: "SCORE",
            ops: ["EQ"],
            sortable: true,
            step: null,
            placeholder: null,
            description: "Which side of the neutral band the Score sits on.",
            options: [
              { value: 1, label: "Bullish" },
              { value: 0, label: "Neutral" },
              { value: -1, label: "Bearish" },
            ],
            quickValues: null,
            values: null,
          },
        ],
        etf: [
          {
            name: "ISSUER",
            label: "Issuer",
            group: "Fund profile",
            type: "STRING",
            unit: null,
            ops: ["IN", "NOT_IN"],
            sortable: false,
            step: null,
            placeholder: null,
            description: "Fund issuer.",
            options: null,
            quickValues: null,
            values: ["Vanguard", "iShares"],
          },
        ],
      }),
    );
    const catalog = await client.screener.fields();
    // The band edges are the preset thresholds; a client that hardcodes 0.5
    // is on the polarity scale, not the Score scale.
    expect(catalog.stock[0].quickValues).toEqual(["5", "13", "23"]);
    // A NUMBER field has no options, and null must not be coerced to [].
    expect(catalog.stock[0].options).toBeNull();
    expect(catalog.stock[1].options!.map((o) => o.label)).toEqual([
      "Bullish",
      "Neutral",
      "Bearish",
    ]);
    expect(catalog.stock[1].ops).toEqual(["EQ"]);
    // Populated from the live universe, so a client must read it rather than
    // ship a static issuer list.
    expect(catalog.etf[0].values).toEqual(["Vanguard", "iShares"]);
  });
});

describe("screener.screens", () => {
  it("returns the curated screens with their plans", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        screens: [
          {
            id: "crowd-vs-street",
            name: "Crowd vs Street",
            summary: "Bullish Score, few analyst buys",
            plan: {
              universe: "STOCK",
              filters: [{ field: "SENTI_SCORE_7D", op: "GTE", value: 5 }],
              sort: { field: "SENTI_SCORE_7D", dir: "DESC" },
            },
          },
        ],
      }),
    );
    const res = await client.screener.screens();
    expect(mockFetch.mock.calls[0][0] as string).toContain("/api/v1/screener/screens");
    expect(res.screens).toHaveLength(1);
    expect(res.screens[0].id).toBe("crowd-vs-street");
    // Curated plans identify the field with `field`, not `fieldName`. Both are
    // accepted on the way in, but a consumer reading only `fieldName` off a
    // curated plan sees nothing at all.
    expect(res.screens[0].plan.filters[0].field).toBe("SENTI_SCORE_7D");
    expect(res.screens[0].plan.filters[0].fieldName).toBeUndefined();
  });

  it("round-trips a curated plan straight into run", async () => {
    const plan = {
      universe: "STOCK" as const,
      filters: [{ field: "CHANGE_PERCENT", op: "GT" as const, value: 0 }],
    };
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ screens: [{ id: "winners", name: "Winners", summary: "Up today", plan }] }),
    );
    const { screens } = await client.screener.screens();

    mockFetch.mockResolvedValueOnce(jsonResponse(EXECUTE_PAYLOAD));
    await client.screener.run({ plan: screens[0].plan });
    expect(requestBody(1).plan).toEqual(plan);
  });
});

describe("screener.run", () => {
  it("posts to the execute path with limit beside the plan", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(EXECUTE_PAYLOAD));
    await client.screener.run({
      plan: { filters: [{ fieldName: "SENTI_SCORE_7D", op: "GTE", value: 13 }] },
      limit: 25,
    });
    expect(mockFetch.mock.calls[0][0] as string).toContain("/api/v1/screener/execute");
    expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    const body = requestBody();
    expect(body.limit).toBe(25);
    expect(body.plan.limit).toBeUndefined();
  });

  it("leaves tickers off the body when the caller omits them", async () => {
    // Absent means the whole tracked universe. An explicit null or [] is a
    // different request.
    mockFetch.mockResolvedValueOnce(jsonResponse(EXECUTE_PAYLOAD));
    await client.screener.run({ plan: { filters: [] } });
    expect(requestBody()).not.toHaveProperty("tickers");
  });

  it("passes a ticker scope through", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(EXECUTE_PAYLOAD));
    await client.screener.run({ plan: { filters: [] }, tickers: ["AAPL", "MSFT"] });
    expect(requestBody().tickers).toEqual(["AAPL", "MSFT"]);
  });

  it("reports matched as the pre-limit count", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(EXECUTE_PAYLOAD));
    const res = await client.screener.run({ plan: { filters: [] }, limit: 2 });
    expect(res.matched).toBe(41);
    expect(res.limit).toBe(2);
    expect(res.results).toHaveLength(2);
  });

  it("keeps nulls and ordinals on the rows", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(EXECUTE_PAYLOAD));
    const res = await client.screener.run({ plan: { filters: [] } });
    const row = res.results[0];
    expect(row.sentiSenseScore7D).toBe(14.2);
    // A missing reading stays null. Coercing it to 0 would make a stock with no
    // 1Y history look flat rather than uncovered.
    expect(row.return1Y).toBeNull();
    expect(row.maCrossState).toBe(1);
    expect(row.sentimentDirection).toBe(1);
    // Inverted vendor scale: 1.9 is bullish, not bearish.
    expect(row.analystRatingMean).toBe(1.9);
    expect(row.sentisenseScoreBars7D).toEqual([11.0, 12.5]);
  });
});

describe("screener.runEtfs", () => {
  it("posts to the ETF path and keeps the two Score readings distinct", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        matched: 3,
        limit: 100,
        results: [
          {
            ticker: "SPY",
            name: "SPDR S&P 500 ETF Trust",
            issuer: "SPDR",
            constituentsWeightedSentisense: 8.4,
            directSentisense: 2.1,
            weightCoveredPct: 91.2,
            expenseRatio: 0.09,
            holdingsCount: 503,
          },
        ],
      }),
    );
    const res = await client.screener.runEtfs({
      plan: { filters: [{ fieldName: "ISSUER", op: "IN", values: ["SPDR"] }] },
      limit: 100,
    });
    expect(mockFetch.mock.calls[0][0] as string).toContain("/api/v1/screener/etfs/execute");
    const row = res.results[0];
    expect(row.constituentsWeightedSentisense).toBe(8.4);
    expect(row.directSentisense).toBe(2.1);
    // Percent points, not a fraction: 0.09 means 0.09%.
    expect(row.expenseRatio).toBe(0.09);
    expect(row.weightCoveredPct).toBe(91.2);
  });

  it("sends values rather than value on a string filter", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ results: [], matched: 0, limit: 100 }));
    await client.screener.runEtfs({
      plan: { filters: [{ fieldName: "ASSET_CLASS", op: "IN", values: ["Equity"] }] },
    });
    const filter = requestBody().plan.filters[0];
    expect(filter.values).toEqual(["Equity"]);
    expect(filter).not.toHaveProperty("value");
  });
});
