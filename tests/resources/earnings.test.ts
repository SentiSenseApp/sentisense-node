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

const PRO_QUARTER = {
  fiscalPeriod: "Q2 2026",
  reportDate: "2026-07-31",
  headline: "Revenue grew 20% and operating income outpaced it",
  summaryMd: "- Revenue was $200.6B, up 20% year over year",
  kpiHighlights: [
    { label: "Net Sales", value: "$200.6B", yoy: "+20% YoY" },
    { label: "Operating income", value: "$27.5B", yoy: "+43% YoY" },
  ],
  guidance: "Q3 net sales guided to $197.0B-$202.0B",
  hasTranscript: true,
  transcriptSummaryMd: "- Management described bookings as ahead of plan",
  transcriptHighlights: [{ label: "Revenue", value: "$200.6B (+20% YoY)" }],
  transcriptGeneratedAt: 1785990279,
  sources: [{ title: "Second quarter results", url: "https://www.example.com/q2" }],
  generatedAt: 1785980000,
  source: "press_release",
};

const FREE_QUARTER = {
  fiscalPeriod: "Q2 2026",
  reportDate: "2026-07-31",
  headline: "Revenue grew 20% and operating income outpaced it",
  kpiHighlights: [
    { label: "Net Sales", value: "$200.6B" },
    { label: "Operating income", value: "$27.5B" },
  ],
  kpiHighlightCount: 6,
  summaryTopics: ["Segment performance", "Margins"],
  transcriptTopics: ["Demand", "Capital spending"],
  hasTranscript: true,
  hasGuidance: true,
  guidanceDirection: "RAISED",
  generatedAt: 1785980000,
  source: "press_release",
};

const REACTIONS_PAYLOAD = {
  ticker: "NVDA",
  asOf: "2026-08-21",
  reactions: [
    {
      reportDate: "2026-05-20",
      timing: "AMC",
      priorClose: 223.47,
      nextClose: 219.51,
      movePct: -1.77,
    },
    {
      reportDate: "2026-02-25",
      timing: null,
      priorClose: 131.28,
      nextClose: 120.15,
      movePct: -8.48,
    },
  ],
};

const STATISTICS_PAYLOAD = {
  calculationVersion: "1.0.0",
  asOf: 1234567890,
  window: {
    key: "2026-W01",
    kind: "COMPLETED_WEEK",
    startDate: "2025-12-29",
    endDate: "2026-01-04",
  },
  eventsInWindow: 120,
  classifiedEvents: 118,
  unclassifiedEvents: 2,
  distinctTickers: 118,
  completedReactions: 104,
  pendingReactions: 14,
  coverageRatio: 0.8814,
  sufficientData: true,
  beat: {
    count: 80,
    rate: 0.678,
    withReaction: 71,
    fell: 30,
    rose: 40,
    flat: 1,
    fellRate: 0.4225,
    averageMovePct: 1.1,
  },
  miss: {
    count: 34,
    rate: 0.2881,
    withReaction: 30,
    fell: 19,
    rose: 11,
    flat: 0,
    fellRate: 0.6333,
    averageMovePct: -2.2,
  },
  inline: {
    count: 4,
    rate: 0.0339,
    withReaction: 3,
    fell: 2,
    rose: 1,
    flat: 0,
    fellRate: 0.6667,
    averageMovePct: -0.4,
  },
  averageMovePct: 0.1,
  baseline: {
    window: {
      key: "2026-W01-trailing52w",
      kind: "TRAILING_BASELINE",
      startDate: "2024-12-30",
      endDate: "2025-12-28",
    },
    classifiedEvents: 2400,
    completedReactions: 2150,
    distinctTickers: 900,
    beatRate: 0.73,
    beatsFellRate: 0.44,
    coverageRatio: 0.8958,
    sufficientData: true,
  },
  deviation: {
    beatRate: -0.052,
    beatsFellRate: -0.0175,
    beatRateIsMaterial: false,
    beatsFellRateIsMaterial: false,
  },
  thresholds: {
    minClassifiedEvents: 30,
    minCoverageRatio: 0.8,
    baselineWeeks: 52,
    beatRateDeviation: 0.1,
    reactionDivergence: 0.07,
  },
};

const RANKED_PRO_PAYLOAD = {
  asOf: 1789000000,
  rankingVersion: "2026.08-v1",
  reported: {
    windowStart: "2026-08-26",
    windowEnd: "2026-09-09",
    totalInWindow: 87,
    rows: [
      {
        ticker: "NVDA",
        reportDate: "2026-08-27",
        fiscalPeriod: "Q2 FY2027",
        headline: "Revenue and earnings exceeded the consensus estimate",
        hasTranscriptSummary: true,
        estimateEps: 1.01,
        actualEps: 1.05,
        surprisePct: 3.96,
        outcome: "BEAT",
        movePct: -6.38,
        reactionPending: false,
        awaitingConsensus: false,
        marketCap: 4400000000000,
        sentisenseScore7d: 12.4,
        scoreChange7d: -3.1,
        importance: 0.93,
      },
    ],
  },
  upcoming: {
    windowStart: "2026-09-09",
    windowEnd: "2026-09-16",
    totalInWindow: 41,
    rows: [
      {
        ticker: "ORCL",
        companyName: "Oracle Corporation",
        earningsDate: "2026-09-10",
        earningsTime: "after_close",
        confirmed: true,
        estimatedEps: 1.48,
        marketCap: 640000000000,
        sentisenseScore7d: 4.2,
        scoreChange7d: 1,
        importance: 0.81,
      },
    ],
  },
};

const RANKED_FREE_PAYLOAD = {
  ...RANKED_PRO_PAYLOAD,
  reported: {
    ...RANKED_PRO_PAYLOAD.reported,
    rows: [
      RANKED_PRO_PAYLOAD.reported.rows[0],
      {
        ticker: "CRM",
        reportDate: "2026-09-02",
        outcome: "INLINE",
        reactionPending: true,
        importance: 0.86,
      },
      {
        ticker: "AVGO",
        reportDate: "2026-09-03",
        outcome: "UNCLASSIFIED",
        awaitingConsensus: true,
        importance: 0.82,
      },
    ],
  },
  upcoming: {
    ...RANKED_PRO_PAYLOAD.upcoming,
    rows: [
      RANKED_PRO_PAYLOAD.upcoming.rows[0],
      {
        ticker: "ADBE",
        companyName: "Adobe Inc.",
        earningsDate: "2026-09-11",
        earningsTime: "after_close",
        confirmed: true,
        importance: 0.76,
      },
      {
        ticker: "KR",
        companyName: "The Kroger Co.",
        earningsDate: "2026-09-12",
        earningsTime: "before_open",
        confirmed: false,
        importance: 0.68,
      },
    ],
  },
};

describe("earnings.getSummaries", () => {
  it("hits the ticker path and upcases the symbol", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, data: [] }));
    await client.earnings.getSummaries("amzn");
    expect(mockFetch.mock.calls[0][0] as string).toContain(
      "/api/v1/stocks/AMZN/earnings-summaries",
    );
  });

  it("sends limit only when supplied", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, data: [] }));
    await client.earnings.getSummaries("AMZN");
    expect(mockFetch.mock.calls[0][0] as string).not.toContain("limit=");

    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, data: [] }));
    await client.earnings.getSummaries("AMZN", { limit: 4 });
    expect(mockFetch.mock.calls[1][0] as string).toContain("limit=4");
  });

  it("returns a PRO quarter with its bodies intact", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, data: [PRO_QUARTER] }),
    );
    const res = await client.earnings.getSummaries("AMZN");

    expect(res.isPreview).toBe(false);
    expect(res.data).toHaveLength(1);
    const quarter = res.data[0];
    expect(quarter.fiscalPeriod).toBe("Q2 2026");
    expect(quarter.reportDate).toBe("2026-07-31");
    expect(quarter.summaryMd).toContain("Revenue was $200.6B");
    expect(quarter.guidance).toContain("Q3 net sales");
    expect(quarter.source).toBe("press_release");
    expect(quarter.generatedAt).toBe(1785980000);
  });

  it("keeps KPI cards and citations structured", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, data: [PRO_QUARTER] }));
    const quarter = (await client.earnings.getSummaries("AMZN")).data[0];

    expect(quarter.kpiHighlights?.map((k) => k.label)).toEqual([
      "Net Sales",
      "Operating income",
    ]);
    expect(quarter.kpiHighlights?.[0].yoy).toBe("+20% YoY");
    expect(quarter.sources?.[0].url).toBe("https://www.example.com/q2");
  });

  it("carries the call summary and its own generated-at", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, data: [PRO_QUARTER] }));
    const quarter = (await client.earnings.getSummaries("AMZN")).data[0];

    expect(quarter.hasTranscript).toBe(true);
    // The call summary can land after the press-release content for the same
    // quarter, so its timestamp is its own and can post-date generatedAt.
    expect(quarter.transcriptGeneratedAt).toBe(1785990279);
    expect(quarter.transcriptGeneratedAt!).toBeGreaterThan(quarter.generatedAt);
    // A call highlight need not carry a year-over-year figure.
    expect(quarter.transcriptHighlights?.[0].yoy).toBeUndefined();
  });

  it("says a quarter has no call rather than omitting the concept", async () => {
    const { transcriptSummaryMd, transcriptHighlights, transcriptGeneratedAt, ...rest } =
      PRO_QUARTER;
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, data: [{ ...rest, hasTranscript: false }] }),
    );
    const quarter = (await client.earnings.getSummaries("AAPL")).data[0];

    expect(quarter.hasTranscript).toBe(false);
    expect(quarter.transcriptSummaryMd).toBeUndefined();
    expect(quarter.transcriptHighlights).toBeUndefined();
  });

  it("returns the free preview shaped, not truncated", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: true,
        previewReason: "PRO_REQUIRED",
        totalCount: 8,
        data: [FREE_QUARTER],
      }),
    );
    const res = await client.earnings.getSummaries("AMZN");

    expect(res.isPreview).toBe(true);
    expect(res.previewReason).toBe("PRO_REQUIRED");
    expect(res.totalCount).toBe(8);

    const quarter = res.data[0];
    expect(quarter.kpiHighlightCount).toBe(6);
    expect(quarter.summaryTopics).toEqual(["Segment performance", "Margins"]);
    expect(quarter.transcriptTopics).toEqual(["Demand", "Capital spending"]);
    expect(quarter.guidanceDirection).toBe("RAISED");
    // The preview never carries a body, a KPI history, or a guidance figure.
    expect(quarter.summaryMd).toBeUndefined();
    expect(quarter.transcriptSummaryMd).toBeUndefined();
    expect(quarter.guidance).toBeUndefined();
    expect(quarter.kpiHighlights?.every((k) => k.yoy === undefined)).toBe(true);
  });

  it("treats an uncovered ticker as an empty list, not an error", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, data: [] }),
    );
    const res = await client.earnings.getSummaries("AAPL");
    expect(res.data).toEqual([]);
  });
});

describe("earnings.getRecent", () => {
  it("hits the feed path with no window arguments by default", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, data: [] }));
    await client.earnings.getRecent();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/earnings/recent");
    expect(url).not.toContain("days=");
    expect(url).not.toContain("limit=");
  });

  it("passes days and limit through", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, data: [] }));
    await client.earnings.getRecent({ days: 14, limit: 25 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("days=14");
    expect(url).toContain("limit=25");
  });

  it("returns rows newest first, with the call-summary flag per row", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: false,
        previewReason: null,
        data: [
          {
            ticker: "MCHP",
            fiscalPeriod: "Q1 FY2027",
            reportDate: "2026-08-06",
            headline: "Net sales rose 38% year over year",
            hasTranscriptSummary: false,
            generatedAt: 1786077821,
          },
          {
            ticker: "AMZN",
            fiscalPeriod: "Q2 2026",
            reportDate: "2026-07-31",
            headline: "Revenue grew 20%",
            hasTranscriptSummary: true,
            generatedAt: 1785990279,
          },
        ],
      }),
    );
    const res = await client.earnings.getRecent({ days: 7 });

    expect(res.isPreview).toBe(false);
    expect(res.data.map((r) => r.ticker)).toEqual(["MCHP", "AMZN"]);
    expect(res.data[0].reportDate).toBe("2026-08-06");
    expect(res.data[0].hasTranscriptSummary).toBe(false);
    expect(res.data[1].hasTranscriptSummary).toBe(true);
  });

  it("treats a quiet window as an empty list, not an error", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ isPreview: false, data: [] }));
    const res = await client.earnings.getRecent({ days: 1 });
    expect(res.data).toEqual([]);
  });
});

describe("earnings.getReactions", () => {
  it("hits the direct ticker path and preserves a null timing field", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(REACTIONS_PAYLOAD));

    const res = await client.earnings.getReactions("nvda");

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/stocks/NVDA/earnings/reactions");
    expect(url).not.toContain("?");
    expect(res.ticker).toBe("NVDA");
    expect(res.reactions[0].movePct).toBe(-1.77);
    expect(res.reactions[1]).toHaveProperty("timing", null);
  });
});

describe("earnings.getStatistics", () => {
  it("passes the window and returns every nested statistics block", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, data: STATISTICS_PAYLOAD }),
    );

    const res = await client.earnings.getStatistics({ window: "last_completed_week" });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/earnings/statistics");
    expect(url).toContain("window=last_completed_week");
    expect(res.isPreview).toBe(false);
    expect(res.data.window.key).toBe("2026-W01");
    expect(res.data.beat.fellRate).toBe(0.4225);
    expect(res.data.baseline?.window.kind).toBe("TRAILING_BASELINE");
    expect(res.data.deviation?.beatRate).toBe(-0.052);
    expect(res.data.thresholds.minClassifiedEvents).toBe(30);
  });
});

describe("earnings.getRanked", () => {
  it("omits query arguments by default", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, data: RANKED_PRO_PAYLOAD }),
    );

    await client.earnings.getRanked();

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/earnings/ranked");
    expect(url).not.toContain("?");
  });

  it("passes every optional window and limit", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, data: RANKED_PRO_PAYLOAD }),
    );

    await client.earnings.getRanked({
      reportedDays: 10,
      reportedLimit: 20,
      upcomingDays: 5,
      upcomingLimit: 15,
    });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("reportedDays=10");
    expect(url).toContain("reportedLimit=20");
    expect(url).toContain("upcomingDays=5");
    expect(url).toContain("upcomingLimit=15");
  });

  it("returns a full ranking with typed row fields", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, data: RANKED_PRO_PAYLOAD }),
    );

    const res = await client.earnings.getRanked();

    expect(res.data.rankingVersion).toBe("2026.08-v1");
    expect(res.data.reported.totalInWindow).toBe(87);
    expect(res.data.reported.rows[0].surprisePct).toBe(3.96);
    expect(res.data.upcoming.rows[0].earningsTime).toBe("after_close");
  });

  it("returns the three-row preview with full window counts", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: true,
        previewReason: "PRO_REQUIRED",
        data: RANKED_FREE_PAYLOAD,
      }),
    );

    const res = await client.earnings.getRanked();

    expect(res.isPreview).toBe(true);
    expect(res.previewReason).toBe("PRO_REQUIRED");
    expect(res.data.reported.totalInWindow).toBe(87);
    expect(res.data.upcoming.totalInWindow).toBe(41);
    expect(res.data.reported.rows).toHaveLength(3);
    expect(res.data.upcoming.rows).toHaveLength(3);
    expect(res.data.reported.rows[1].estimateEps).toBeUndefined();
    expect(res.data.upcoming.rows[1].estimatedEps).toBeUndefined();
  });
});
