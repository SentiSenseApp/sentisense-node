import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense, { AuthenticationError, NotFoundError } from "../../src/index.js";
import type { StockRating } from "../../src/index.js";

/**
 * The rating's failure modes are all quiet, which is why they are gated here rather than
 * described in a doc comment alone:
 *
 * - Not being rated is a 200 with `rated` false, never a 404. A caller that treats "no
 *   grade" as an error surfaces an exception for every ETF it asks about.
 * - An absent dimension is a full row with `present` false and a null percentile. Read as
 *   zero, the dimension we know nothing about ranks at the bottom of the market.
 * - `letter` is the band of `score`, not of `percentile`, and it is served as stored. A
 *   client that recomputes it from the percentile disagrees with the API for every stock
 *   carrying a risk condition.
 * - `score` is `percentile` less the summed `riskAdjustments` points, and a condition is
 *   graded rather than binary, so the points are read off the response instead of
 *   multiplied out from how many conditions are listed.
 * - `score`, `bucketLetter`, `riskConditions`, `riskAdjustments` and `penaltyPoints` are
 *   optional: a response served before they shipped omits them and must still parse.
 * - Only the smart-money dimension carries `subLegs`; on every other one the field is
 *   absent, which must read as "no legs" rather than "legs of zero".
 *
 * The payloads are trimmed copies of live responses.
 */

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

const client = new SentiSense({ apiKey: "test-key", maxRetries: 0 });

const DISCLAIMER =
  "The SentiSense Rating is a relative, automatically generated research signal for " +
  "informational and educational purposes only. It is not financial, investment or " +
  "trading advice, and it is not a recommendation about any security.";

const RATED = {
  ticker: "AAPL",
  kbEntityId: "kb/company/1",
  rated: true,
  // 79.96 less the summed adjustments, reported to one decimal.
  score: 59.5,
  letter: "C",
  bucketLetter: "B",
  percentile: 79.96146435452793,
  composite: 0.21454864250697855,
  riskConditions: ["unprofitable", "leverage_above_2x"],
  riskAdjustments: [
    { condition: "unprofitable", points: 12.0 },
    { condition: "leverage_above_2x", points: 8.5 },
  ],
  penaltyPoints: 20.5,
  ratedCount: 1038,
  asOf: "2026-09-03",
  methodologyVersion: "2026.09-v1",
  dimensions: [
    {
      key: "crowd",
      label: "Crowd sentiment",
      percentile: 86.0488798370672,
      raw: 9.16962530776088,
      rawLabel: "7-day SentiSense Score",
      present: true,
    },
    {
      key: "smart_money",
      label: "Smart money",
      percentile: 44.55159112825458,
      raw: null,
      rawLabel: null,
      present: true,
      subLegs: [
        { key: "inst_13f", label: "13F net change", raw: 4.01649118338024, unit: "%" },
        { key: "insider", label: "Insider flow balance", raw: -1.0, unit: "ratio" },
        { key: "congress", label: "Congress flow balance", raw: null, unit: "ratio" },
      ],
    },
    {
      key: "options",
      label: "Options positioning",
      percentile: null,
      raw: null,
      rawLabel: "Options sentiment",
      present: false,
    },
  ],
  flags: [
    { key: "clustered_insider_selling", label: "Clustered insider selling", active: false },
    { key: "unusual_options_flow", label: "Unusual options flow", active: true },
  ],
  disclaimer: DISCLAIMER,
};

// The same stock as served before the score fields shipped: all four absent rather than
// null, which is the shape the optional typing exists for.
const LEGACY_RATED = (() => {
  const { score, bucketLetter, riskConditions, riskAdjustments, penaltyPoints, ...rest } =
    RATED;
  void score;
  void bucketLetter;
  void riskConditions;
  void riskAdjustments;
  void penaltyPoints;
  return { ...rest, letter: "B" };
})();

const NOT_RATED = {
  ticker: "SPY",
  kbEntityId: "kb/etf/3",
  rated: false,
  asOf: "2026-09-03",
  reason: "not_rated_today",
  dimensionsPresent: 0,
  presentDimensions: [],
  dimensions: [
    {
      key: "crowd",
      label: "Crowd sentiment",
      percentile: null,
      raw: null,
      rawLabel: "7-day SentiSense Score",
      present: false,
    },
    {
      key: "smart_money",
      label: "Smart money",
      percentile: null,
      raw: null,
      rawLabel: null,
      present: false,
    },
  ],
  flags: [],
  disclaimer: DISCLAIMER,
};

describe("stocks.getRating: the graded shape", () => {
  it("calls the rating endpoint with an uppercased ticker", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(RATED));
    await client.stocks.getRating("aapl");
    expect(mockFetch.mock.calls[0][0]).toContain("/api/v1/rating/AAPL");
  });

  it("carries the headline grade and the rank's denominator", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(RATED));
    const rating = await client.stocks.getRating("AAPL");
    expect(rating.rated).toBe(true);
    if (!rating.rated) throw new Error("expected a rated response");
    expect(rating.letter).toBe("C");
    expect(rating.score).toBeCloseTo(59.5);
    expect(rating.percentile).toBeCloseTo(79.9614643);
    expect(rating.composite).toBeCloseTo(0.2145486);
    // Without the denominator a percentile is a number with no cohort behind it.
    expect(rating.ratedCount).toBe(1038);
    expect(rating.methodologyVersion).toBe("2026.09-v1");
    expect(rating.kbEntityId).toBe("kb/company/1");
  });

  it("returns the served letter rather than one derived from the percentile", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(RATED));
    const rating = await client.stocks.getRating("AAPL");
    if (!rating.rated) throw new Error("expected a rated response");
    expect(rating.letter).toBe(RATED.letter);
  });

  it("carries the disclaimer every rating surface has to display", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(RATED));
    const rating = await client.stocks.getRating("AAPL");
    expect(rating.disclaimer).toBe(DISCLAIMER);
  });
});

describe("stocks.getRating: the score and its risk conditions", () => {
  it("reports the score as the percentile less the summed adjustments", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(RATED));
    const rating = await client.stocks.getRating("AAPL");
    if (!rating.rated) throw new Error("expected a rated response");
    expect(rating.score).toBeCloseTo(59.5);
    expect(rating.penaltyPoints).toBeCloseTo(20.5);
    // The total is the sum of the graded rows, not 12 times how many there are: a
    // condition can cost anything up to 12, and the second one here costs 8.5.
    const summed = (rating.riskAdjustments ?? []).reduce((t, a) => t + a.points, 0);
    expect(rating.penaltyPoints).toBeCloseTo(summed);
    expect(rating.penaltyPoints).not.toBe(12 * (rating.riskConditions?.length ?? 0));
    expect(rating.score).toBeCloseTo(rating.percentile - rating.penaltyPoints!, 0);
  });

  it("itemises each adjustment with its condition and its cost", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(RATED));
    const rating = await client.stocks.getRating("AAPL");
    if (!rating.rated) throw new Error("expected a rated response");
    expect(rating.riskAdjustments).toEqual([
      { condition: "unprofitable", points: 12.0 },
      { condition: "leverage_above_2x", points: 8.5 },
    ]);
    // Every graded row names a condition that is also listed as active.
    expect(rating.riskAdjustments?.map((a) => a.condition)).toEqual(rating.riskConditions);
  });

  it("bands the letter off the score, not off the percentile", async () => {
    // 79.9 would band as B. The two conditions take the score to 59.5, which bands as C,
    // and `bucketLetter` keeps the pre-penalty band visible next to it.
    mockFetch.mockResolvedValueOnce(jsonResponse(RATED));
    const rating = await client.stocks.getRating("AAPL");
    if (!rating.rated) throw new Error("expected a rated response");
    expect(rating.letter).toBe("C");
    expect(rating.bucketLetter).toBe("B");
    expect(rating.letter).not.toBe(rating.bucketLetter);
  });

  it("names the active conditions", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(RATED));
    const rating = await client.stocks.getRating("AAPL");
    if (!rating.rated) throw new Error("expected a rated response");
    expect(rating.riskConditions).toEqual(["unprofitable", "leverage_above_2x"]);
  });

  it("parses a response served before the four fields shipped", async () => {
    // Absent has to read as "not reported", never as a zero that would look like a stock
    // carrying no conditions at all.
    mockFetch.mockResolvedValueOnce(jsonResponse(LEGACY_RATED));
    const rating = await client.stocks.getRating("AAPL");
    expect(rating.rated).toBe(true);
    if (!rating.rated) throw new Error("expected a rated response");
    expect(rating.score).toBeUndefined();
    expect(rating.bucketLetter).toBeUndefined();
    expect(rating.penaltyPoints).toBeUndefined();
    expect(rating.riskConditions).toBeUndefined();
    expect(rating.riskAdjustments).toBeUndefined();
    // Everything that was there before is untouched.
    expect(rating.letter).toBe("B");
    expect(rating.percentile).toBeCloseTo(79.9614643);
    expect(rating.ratedCount).toBe(1038);
    expect(rating.dimensions).toHaveLength(3);
  });
});

describe("stocks.getRating: dimensions", () => {
  it("keeps an absent dimension as a row rather than dropping it", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(RATED));
    const rating = await client.stocks.getRating("AAPL");
    const options = rating.dimensions.find((d) => d.key === "options");
    expect(options).toBeDefined();
    expect(options?.present).toBe(false);
    // Null, not zero. Zero is the bottom of the cross-section; absence is not a position
    // on it, and a dropped row would read as a five-dimension rating.
    expect(options?.percentile).toBeNull();
    expect(options?.raw).toBeNull();
  });

  it("carries the raw reading and its unit label on a present dimension", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(RATED));
    const rating = await client.stocks.getRating("AAPL");
    const crowd = rating.dimensions.find((d) => d.key === "crowd");
    expect(crowd?.present).toBe(true);
    expect(crowd?.raw).toBeCloseTo(9.1696253);
    expect(crowd?.rawLabel).toBe("7-day SentiSense Score");
  });

  it("attaches legs to smart money alone", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(RATED));
    const rating = await client.stocks.getRating("AAPL");
    const smartMoney = rating.dimensions.find((d) => d.key === "smart_money");
    expect(smartMoney?.subLegs?.map((l) => l.key)).toEqual([
      "inst_13f",
      "insider",
      "congress",
    ]);
    expect(smartMoney?.subLegs?.[0].unit).toBe("%");
    expect(smartMoney?.subLegs?.[1].unit).toBe("ratio");
    // A leg with no data reports null, because a zero balance is a real reading.
    expect(smartMoney?.subLegs?.[2].raw).toBeNull();
    // Every other dimension omits the field entirely.
    expect(rating.dimensions.find((d) => d.key === "crowd")?.subLegs).toBeUndefined();
  });
});

describe("stocks.getRating: flags", () => {
  it("keeps evaluated-and-inactive distinct from not evaluated", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(RATED));
    const rating = await client.stocks.getRating("AAPL");
    const byKey = Object.fromEntries(rating.flags.map((f) => [f.key, f]));
    expect(byKey.unusual_options_flow.active).toBe(true);
    // Present and false means the rule ran and did not trigger. A rule the run could not
    // evaluate is absent from the list instead.
    expect(byKey.clustered_insider_selling.active).toBe(false);
    expect(byKey.institutional_outflow_against_price).toBeUndefined();
  });
});

describe("stocks.getRating: the ungraded shape", () => {
  it("reports no grade as a normal response, not an error", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(NOT_RATED));
    const rating = await client.stocks.getRating("SPY");
    expect(rating.rated).toBe(false);
    if (rating.rated) throw new Error("expected an unrated response");
    expect(rating.reason).toBe("not_rated_today");
    expect(rating.dimensionsPresent).toBe(0);
    expect(rating.presentDimensions).toEqual([]);
  });

  it("still carries the composition, the date and the disclaimer", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(NOT_RATED));
    const rating = await client.stocks.getRating("SPY");
    expect(rating.dimensions.map((d) => d.key)).toEqual(["crowd", "smart_money"]);
    expect(rating.dimensions.every((d) => d.present === false)).toBe(true);
    expect(rating.asOf).toBe("2026-09-03");
    expect(rating.disclaimer).toBe(DISCLAIMER);
  });

  it("names the dimensions that did have data", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ...NOT_RATED,
        reason: "insufficient_dimensions",
        dimensionsPresent: 2,
        presentDimensions: ["crowd", "analysts"],
      }),
    );
    const rating = await client.stocks.getRating("SPY");
    if (rating.rated) throw new Error("expected an unrated response");
    // A refusal and an out-of-universe ticker are different answers, and `reason` is
    // what separates them.
    expect(rating.reason).toBe("insufficient_dimensions");
    expect(rating.presentDimensions).toEqual(["crowd", "analysts"]);
  });

  it("narrows on `rated`, so the graded fields are unreachable on this branch", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(NOT_RATED));
    const rating: StockRating = await client.stocks.getRating("SPY");
    const headline = rating.rated ? rating.letter : rating.reason;
    expect(headline).toBe("not_rated_today");
  });
});

describe("stocks.getRating: errors", () => {
  it("rejects an unresolvable ticker with NotFoundError", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "entity_not_found", message: "Unknown ticker 'ZZZZ'." }, 404),
    );
    await expect(client.stocks.getRating("ZZZZ")).rejects.toThrow(NotFoundError);
  });

  it("rejects a keyless request with AuthenticationError", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "api_key_required", message: "API key is required." }, 401),
    );
    const anonymous = new SentiSense({ maxRetries: 0 });
    await expect(anonymous.stocks.getRating("AAPL")).rejects.toThrow(AuthenticationError);
  });
});
