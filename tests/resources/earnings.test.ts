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
