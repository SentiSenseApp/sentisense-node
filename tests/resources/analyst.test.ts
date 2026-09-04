import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense, { NotFoundError } from "../../src/index.js";
import type { AnalystRatingBuckets } from "../../src/index.js";

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

function errorResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("analyst.coverage", () => {
  it("uppercases the ticker and leaves the window to the server when unset", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, data: { coverage: [] } }),
    );
    await client.analyst.coverage("amd");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/analyst/AMD/coverage");
    expect(url).not.toContain("lookbackDays");
  });

  it("forwards lookbackDays", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, data: { coverage: [] } }),
    );
    await client.analyst.coverage("AMD", { lookbackDays: 180 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("lookbackDays=180");
  });

  it("keeps the response-level counts when a free key truncates the rows", async () => {
    // The counts describe the whole window, so they must survive the 5-row truncation.
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: true,
        previewReason: "PRO_REQUIRED",
        data: {
          ticker: "NVDA",
          windowDays: 365,
          asOf: "2026-09-01",
          firmCount: 41,
          ratingOnlyFirmCount: 6,
          namedAnalystCount: 27,
          noteCount: 97,
          attributedNoteCount: 53,
          unattributedNoteCount: 44,
          attributionNote: "Publishers name the individual analyst on some notes and not others.",
          coverage: [
            {
              firm: "DA Davidson",
              analysts: [
                {
                  slug: "gil-luria",
                  name: "Gil Luria",
                  noteCount: 3,
                  firstNote: "2025-09-22",
                  lastNote: "2026-08-27",
                  latestPriceTarget: 300.0,
                },
              ],
              noteCount: 3,
              attributedNoteCount: 3,
              unattributedNoteCount: 0,
              firstNote: "2025-09-22",
              lastNote: "2026-08-27",
              latestNote: {
                publishedDate: "2026-08-27",
                analyst: "Gil Luria",
                priceTarget: 300.0,
                adjPriceTarget: 300.0,
                priceWhenPosted: 225.64,
                newsTitle: "DA Davidson Reiterates Buy Rating on NVIDIA",
                newsUrl: "https://example.com/note",
                newsPublisher: "StreetInsider",
              },
              firmRating: {
                rating: "Buy",
                priorRating: "Buy",
                actionType: "REITERATE",
                date: "2026-08-27",
              },
            },
          ],
        },
      }),
    );
    const result = await client.analyst.coverage("NVDA");
    expect(result.isPreview).toBe(true);
    expect(result.previewReason).toBe("PRO_REQUIRED");
    expect(result.data.coverage).toHaveLength(1);
    expect(result.data.firmCount).toBe(41);
    expect(result.data.ratingOnlyFirmCount).toBe(6);
    // The named analyst carries the slug that addresses profile() and calls().
    expect(result.data.coverage[0].analysts[0].slug).toBe("gil-luria");
  });

  it("counts the whole book in ratingBuckets even when the rows are truncated", async () => {
    // The buckets are computed before the FREE 5-row truncation, so a preview
    // response still sizes every covering firm and the parts sum to the total.
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: true,
        previewReason: "PRO_REQUIRED",
        data: {
          ticker: "NVDA",
          firmCount: 41,
          ratingOnlyFirmCount: 6,
          ratingBuckets: { buy: 30, hold: 1, sell: 0, unrated: 10, total: 41 },
          coverage: [
            {
              firm: "DA Davidson",
              analysts: [],
              noteCount: 1,
              attributedNoteCount: 0,
              unattributedNoteCount: 1,
              firstNote: "2026-08-27",
              lastNote: "2026-08-27",
              latestNote: null,
              firmRating: { rating: "Buy", priorRating: "Buy", actionType: "REITERATE", date: "2026-08-27" },
            },
          ],
        },
      }),
    );
    const result = await client.analyst.coverage("NVDA");
    const buckets: AnalystRatingBuckets | undefined = result.data.ratingBuckets;
    expect(buckets).toBeDefined();
    expect(buckets!.buy).toBe(30);
    // A desk with no current rating lands in unrated, not in hold.
    expect(buckets!.unrated).toBe(10);
    expect(buckets!.buy + buckets!.hold + buckets!.sell + buckets!.unrated).toBe(buckets!.total);
    expect(buckets!.total).toBe(result.data.firmCount);
    expect(result.data.coverage).toHaveLength(1);
  });

  it("returns a rating-only firm as an ordinary row with no note", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: false,
        previewReason: null,
        data: {
          ticker: "NVDA",
          firmCount: 1,
          ratingOnlyFirmCount: 1,
          coverage: [
            {
              firm: "Citigroup",
              analysts: [],
              noteCount: 0,
              attributedNoteCount: 0,
              unattributedNoteCount: 0,
              firstNote: null,
              lastNote: null,
              latestNote: null,
              firmRating: {
                rating: "Buy",
                priorRating: "Buy",
                actionType: "REITERATE",
                date: "2026-08-27",
              },
            },
          ],
        },
      }),
    );
    const row = (await client.analyst.coverage("NVDA")).data.coverage[0];
    expect(row.noteCount).toBe(0);
    expect(row.latestNote).toBeNull();
    expect(row.firmRating?.rating).toBe("Buy");
  });

  it("keeps an unattributed note rather than dropping it", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: false,
        previewReason: null,
        data: {
          ticker: "NVDA",
          coverage: [
            {
              firm: "Deutsche Bank",
              analysts: [],
              noteCount: 1,
              attributedNoteCount: 0,
              unattributedNoteCount: 1,
              firstNote: "2025-11-20",
              lastNote: "2025-11-20",
              latestNote: {
                publishedDate: "2025-11-20",
                analyst: null,
                priceTarget: 215.0,
                adjPriceTarget: 215.0,
                priceWhenPosted: 186.52,
                newsTitle: "Nvidia price target raised",
                newsUrl: "https://example.com/note",
                newsPublisher: "TheFly",
              },
              firmRating: null,
            },
          ],
        },
      }),
    );
    const row = (await client.analyst.coverage("NVDA")).data.coverage[0];
    expect(row.analysts).toEqual([]);
    expect(row.noteCount).toBe(1);
    expect(row.latestNote?.analyst).toBeNull();
  });

  it("throws NotFoundError for a ticker with no coverage", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404, { error: "not_found" }));
    await expect(client.analyst.coverage("NOSUCH")).rejects.toThrow(NotFoundError);
  });
});

describe("analyst.profile", () => {
  it("hits the people path", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, data: { slug: "dan-ives" } }),
    );
    await client.analyst.profile("dan-ives");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/analyst/people/dan-ives");
  });

  it("reports the full book size in totalCount when the free tier truncates it", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: true,
        previewReason: "PRO_REQUIRED",
        totalCount: 24,
        data: {
          slug: "gil-luria",
          name: "Gil Luria",
          role: "sell_side_equity",
          mostRecentFirm: "DA Davidson",
          firms: [
            {
              firm: "DA Davidson",
              firstSeen: "2023-01-05",
              lastSeen: "2026-08-27",
              mostRecent: true,
            },
          ],
          firstSeen: "2023-01-05",
          lastSeen: "2026-08-27",
          noteCount: 60,
          tickerCount: 24,
          coverage: [
            {
              ticker: "NVDA",
              noteCount: 5,
              firstNote: "2024-05-23",
              lastNote: "2026-08-27",
              latestPriceTarget: 300.0,
              latestFirm: "DA Davidson",
            },
          ],
        },
      }),
    );
    const result = await client.analyst.profile("gil-luria");
    expect(result.isPreview).toBe(true);
    expect(result.totalCount).toBe(24);
    expect(result.data.coverage).toHaveLength(1);
    expect(result.data.firms[0].mostRecent).toBe(true);
  });

  it("throws NotFoundError on an unknown slug", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404, { error: "not_found" }));
    await expect(client.analyst.profile("no-such-analyst")).rejects.toThrow(NotFoundError);
  });
});

describe("analyst.calls", () => {
  it("leaves paging to the server when unset", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, totalCount: 0, data: [] }),
    );
    await client.analyst.calls("dan-ives");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/analyst/people/dan-ives/calls");
    expect(url).not.toContain("limit");
    expect(url).not.toContain("offset");
  });

  it("forwards limit and offset", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, totalCount: 0, data: [] }),
    );
    await client.analyst.calls("dan-ives", { limit: 50, offset: 25 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("limit=50");
    expect(url).toContain("offset=25");
  });

  it("totalCount sizes the whole history, not the page", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: false,
        previewReason: null,
        totalCount: 60,
        data: [
          {
            publishedDate: "2026-08-27",
            ticker: "NVDA",
            firm: "DA Davidson",
            priceTarget: 300.0,
            adjPriceTarget: 300.0,
            priceWhenPosted: 225.64,
            newsTitle: "DA Davidson Reiterates Buy Rating on NVIDIA",
            newsUrl: "https://example.com/note",
            newsPublisher: "StreetInsider",
          },
        ],
      }),
    );
    const result = await client.analyst.calls("gil-luria", { limit: 1 });
    expect(result.totalCount).toBe(60);
    expect(result.data[0].ticker).toBe("NVDA");
    // One row of sixty: another page is available.
    expect(0 + result.data.length).toBeLessThan(result.totalCount!);
  });

  it("previews a deep offset on a free key", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: true,
        previewReason: "PRO_REQUIRED",
        totalCount: 60,
        data: [],
      }),
    );
    const result = await client.analyst.calls("gil-luria", { limit: 25, offset: 50 });
    expect(result.isPreview).toBe(true);
    expect(result.previewReason).toBe("PRO_REQUIRED");
    expect(result.data).toEqual([]);
  });

  it("throws NotFoundError on an unknown slug", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404, { error: "not_found" }));
    await expect(client.analyst.calls("no-such-analyst")).rejects.toThrow(NotFoundError);
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

describe("stocks.listKpiCoverage + getKpiTypes", () => {
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
