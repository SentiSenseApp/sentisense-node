import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import SentiSense, {
  type EarningsEvent,
  type Fundamentals,
  type RankedUpcomingEarnings,
  type Story,
} from "../../src/index.js";

/**
 * Documented fields the wire already carried but the types did not declare. Each test reads
 * the field with no cast, so `npm run typecheck` fails if the declaration goes missing, and
 * checks the value passes through untouched.
 */

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

const STORY = {
  id: "c-123",
  clusterId: "c-123",
  cluster: {
    id: "c-123",
    title: "Example story",
    clusterSize: 4,
    averageSentiment: 0.2,
    clusteredAt: 1794611213,
    storySource: "AI",
    isLive: false,
  },
  displayTickers: ["Example Inc (EXMP)"],
  tickers: ["EXMP"],
  primaryEntityNames: ["Example Inc"],
  impactScore: 6.1,
  brokeAt: 1794610000,
};

describe("typed wire fields", () => {
  it("Story types the story id once, at cluster.id", async () => {
    respond([STORY]);
    const [story] = await client.documents.getStories({ limit: 1 });
    expectTypeOf(story.cluster.id).toEqualTypeOf<string>();
    // One value, one typed name: the Story type declares no second name for the story id.
    expectTypeOf<Story>().not.toHaveProperty("id");
    expectTypeOf<Story>().not.toHaveProperty("clusterId");

    // cluster.id goes straight to the detail call.
    respond({ id: "c-123" });
    await client.documents.getStoryDetail(story.cluster.id);
    expect(String(mockFetch.mock.calls[1][0])).toContain("/api/v1/documents/stories/c-123");
  });

  it("a fund's stock quote carries seeInstead", async () => {
    respond({
      ticker: "SPY",
      currentPrice: 762.63,
      change: -1.57,
      changePercent: -0.2,
      timestamp: 1790841278705,
      seeInstead: ["/api/v1/etfs/SPY/quote"],
    });
    const quote = await client.stocks.getQuote("SPY");
    expectTypeOf(quote.seeInstead).toEqualTypeOf<string[] | undefined>();
    expect(quote.seeInstead).toEqual(["/api/v1/etfs/SPY/quote"]);
  });

  it("the sentiment reading carries both thin-sample flags", async () => {
    respond({
      isPreview: false,
      previewReason: null,
      data: {
        ticker: "EXMP",
        sentisenseScore: 4.2,
        sentisenseScoreThinSample: true,
        sentisenseScoreAvg30dThinSample: false,
      },
    });
    const sentiment = await client.stocks.getSentiment("EXMP");
    expectTypeOf(sentiment.data.sentisenseScoreThinSample).toEqualTypeOf<boolean | undefined>();
    expect(sentiment.data.sentisenseScoreThinSample).toBe(true);
    expect(sentiment.data.sentisenseScoreAvg30dThinSample).toBe(false);
  });

  it("a rating carries companyName and betaNotice on either shape", async () => {
    respond({
      ticker: "EXMP",
      companyName: "Example Inc.",
      kbEntityId: "kb/company/1",
      asOf: "2026-11-13",
      rated: true,
      letter: "B",
      percentile: 71.2,
      composite: 0.21,
      ratedCount: 1400,
      methodologyVersion: "2026.09-v1",
      dimensions: [],
      flags: [],
      disclaimer: "Not investment advice.",
      betaNotice: "Beta: the response shape is stable.",
    });
    const rating = await client.stocks.getRating("EXMP");
    expectTypeOf(rating.companyName).toEqualTypeOf<string | undefined>();
    expectTypeOf(rating.betaNotice).toEqualTypeOf<string | undefined>();
    expect(rating.companyName).toBe("Example Inc.");
    expect(rating.betaNotice).toBe("Beta: the response shape is stable.");
  });

  it("a ticker-filtered calendar carries latestReported", async () => {
    const latest: EarningsEvent = {
      ticker: "EXMP",
      companyName: "Example Inc.",
      earningsDate: "2026-10-30",
      earningsTime: "after_close",
      fiscalQuarter: "Q3 2026",
      confirmed: true,
      estimatedEps: 1.6,
      actualEps: 1.72,
    };
    respond({
      isPreview: false,
      previewReason: null,
      data: { earnings: [], metadata: { generatedAt: null, windowStart: null, windowEnd: null, count: 0, source: "sentisense" }, latestReported: latest },
    });
    const calendar = await client.calendar.getEarnings({ ticker: "EXMP" });
    expectTypeOf(calendar.data.latestReported).toEqualTypeOf<EarningsEvent | undefined>();
    expect(calendar.data.latestReported).toEqual(latest);
  });

  it("a ranked reported row carries surpriseFlag in place of surprisePct", async () => {
    const row = {
      ticker: "EXMP",
      reportDate: "2026-11-10",
      estimateEps: -0.05,
      actualEps: 0.12,
      surpriseFlag: "SIGN_FLIP",
      outcome: "BEAT",
      importance: 0.4,
    };
    respond({
      isPreview: false,
      previewReason: null,
      data: {
        asOf: 1794600000,
        rankingVersion: "v1",
        reported: { windowStart: "2026-11-01", windowEnd: "2026-11-14", totalInWindow: 1, rows: [row] },
        upcoming: { windowStart: "2026-11-14", windowEnd: "2026-11-21", totalInWindow: 0, rows: [] },
      },
    });
    const ranked = await client.earnings.getRanked();
    const reported = ranked.data.reported.rows[0];
    expect(reported.surpriseFlag).toBe("SIGN_FLIP");
    expect(reported.surprisePct).toBeUndefined();
  });

  it("fields the API may leave out are typed optional", () => {
    // The API omits a field it has no value for, so these read as possibly undefined.
    expectTypeOf<RankedUpcomingEarnings["companyName"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<RankedUpcomingEarnings["earningsTime"]>().toEqualTypeOf<
      "before_open" | "after_close" | "during_market" | "unknown" | undefined
    >();
    // A statement period carries no timeframe; the history envelope does.
    expectTypeOf<Fundamentals["timeframe"]>().toEqualTypeOf<string | undefined>();
  });

  it("a ranked reported row carries afterHoursReactionPct on the report night", async () => {
    const row = {
      ticker: "EXMP",
      reportDate: "2026-11-13",
      estimateEps: 0.38,
      actualEps: 0.51,
      surprisePct: 34.21,
      outcome: "BEAT",
      reactionPending: true,
      afterHoursReactionPct: 4.13,
      importance: 0.7,
    };
    respond({
      isPreview: false,
      previewReason: null,
      data: {
        asOf: 1794600000,
        rankingVersion: "v1",
        reported: { windowStart: "2026-11-01", windowEnd: "2026-11-14", totalInWindow: 1, rows: [row] },
        upcoming: { windowStart: "2026-11-14", windowEnd: "2026-11-21", totalInWindow: 0, rows: [] },
      },
    });
    const ranked = await client.earnings.getRanked();
    const reported = ranked.data.reported.rows[0];
    expectTypeOf(reported.afterHoursReactionPct).toEqualTypeOf<number | undefined>();
    expect(reported.afterHoursReactionPct).toBe(4.13);
    expect(reported.reactionPending).toBe(true);
    // A row carries at most one of the three reaction readings.
    expect(reported.movePct).toBeUndefined();
    expect(reported.liveReactionPct).toBeUndefined();
  });

  it("a screener stock row carries the two thin-sample flags", async () => {
    respond({
      matched: 1,
      results: [{ ticker: "EXMP", sentiSenseScore7D: 3.1, sentiSenseScore1M: 2.2, sentiSenseScore7DThinSample: true, sentiSenseScore1MThinSample: false }],
    });
    const screen = await client.screener.run({ plan: { filters: [] } });
    const row = screen.results[0];
    expectTypeOf(row.sentiSenseScore7DThinSample).toEqualTypeOf<boolean | undefined>();
    expect(row.sentiSenseScore7DThinSample).toBe(true);
    expect(row.sentiSenseScore1MThinSample).toBe(false);
  });
});
