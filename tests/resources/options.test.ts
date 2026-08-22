import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense from "../../src/index.js";

/**
 * The radar's two failure modes are both silent, which is why they are gated here rather
 * than described in a doc comment alone:
 *
 * - `rows` and `etfRows` are separately-ranked boards. Merging them yields a list that
 *   sorts cleanly and ranks nothing, because each row's score is built from percentiles
 *   against that ticker's own history, not against the board.
 * - A row whose baseline is still building carries raw readings with its percentiles and
 *   `interestScore` omitted. Read as zero, that row reads as the least interesting name on
 *   the board when it is really the least *measured* one.
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

const client = new SentiSense({ apiKey: "test-key" });

describe("options.getOverview", () => {
  it("calls the market-wide radar endpoint with no ticker in the path", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, data: { asOf: "2026-08-20" } }),
    );
    const result = await client.options.getOverview();
    expect(mockFetch.mock.calls[0][0]).toContain("/api/v1/options/overview");
    expect(result.data?.asOf).toBe("2026-08-20");
  });

  it("keeps the stock board and the ETF board separate, with their own aggregates", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: false,
        previewReason: null,
        data: {
          asOf: "2026-08-20",
          medianIvRank: 30.8,
          marketPcVol: 0.646,
          extremeCount: 198,
          coverageCount: 1018,
          rows: [{ ticker: "ROST", sector: "Consumer Discretionary", interestScore: 89.7 }],
          etfRows: [{ ticker: "VIS", sector: "Equity", interestScore: 77.4 }],
          etfMedianIvRank: 35.7,
          etfMarketPcVol: 0.942,
          etfExtremeCount: 10,
          etfCoverageCount: 71,
        },
      }),
    );
    const result = await client.options.getOverview();
    expect(result.data?.rows?.[0].ticker).toBe("ROST");
    expect(result.data?.etfRows?.[0].ticker).toBe("VIS");
    // Two boards, two coverage denominators. Reading either aggregate as market-wide is
    // the mistake: `coverageCount` never counts an ETF.
    expect(result.data?.coverageCount).toBe(1018);
    expect(result.data?.etfCoverageCount).toBe(71);
    // On an ETF row `sector` carries the fund's asset class, not a GICS sector, so the two
    // boards' values must not feed one sector breakdown.
    expect(result.data?.etfRows?.[0].sector).toBe("Equity");
  });

  it("leaves a building baseline's percentiles and score undefined rather than zero", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: false,
        previewReason: null,
        data: {
          asOf: "2026-08-20",
          rows: [{ ticker: "NEWCO", atmIv: 0.61, pcVol: 1.2, observations1y: 12 }],
        },
      }),
    );
    const row = (await client.options.getOverview()).data?.rows?.[0];
    expect(row?.atmIv).toBe(0.61);
    expect(row?.interestScore).toBeUndefined();
    expect(row?.ivRank1y).toBeUndefined();
    expect(row?.skewPctl1y).toBeUndefined();
  });

  it("reports a truncated free board through totalCount while the coverage counts stay full", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: true,
        previewReason: "PRO_REQUIRED",
        totalCount: 1018,
        data: {
          asOf: "2026-08-20",
          coverageCount: 1018,
          rows: [{ ticker: "ROST" }],
          etfRows: [{ ticker: "VIS" }],
          etfCoverageCount: 71,
          etfTotalCount: 71,
        },
      }),
    );
    const result = await client.options.getOverview();
    expect(result.isPreview).toBe(true);
    expect(result.previewReason).toBe("PRO_REQUIRED");
    expect(result.totalCount).toBe(1018);
    expect(result.data?.etfTotalCount).toBe(71);
  });

  it("reads a null payload as a cold start rather than an error", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, data: null }),
    );
    const result = await client.options.getOverview();
    expect(result.data).toBeNull();
  });
});
