import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import SentiSense from "../../src/index.js";
import type {
  OptionsAggregate,
  OptionsCapabilities,
  OptionsHighlight,
  OptionsIntradayBoardCapability,
  OptionsIntradayFlow,
  OptionsOiFollowUp,
  OptionsOverview,
  OptionsSummary,
} from "../../src/index.js";

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

  it("exposes typed session highlights for both boards", async () => {
    const stock = {
      ticker: "NVDA", contract: "NVDA260821C00217500", type: "call",
      strike: 217.5, expiry: "2026-08-21", dte: 1, volume: 900,
      oi: 100, volOiRatio: 9, premium: 19321974, premiumPctl1y: 98.5,
      oiPrior: 100, oiNext: 650, oiChange: 550, oiConfirmation: "opened",
      oiObservedAt: 1787335200, oiVintage: "next_session", asOf: "2026-08-20",
      publishedAt: "2026-08-21T01:00:00Z", session: "completed",
    } satisfies OptionsHighlight;
    const etf = { ...stock, ticker: "SPY", contract: "SPY260821P00600000" };
    mockFetch.mockResolvedValueOnce(jsonResponse({
      isPreview: false, previewReason: null,
      data: { highlights: [stock], etfHighlights: [etf] },
    }));
    const result = await client.options.getOverview();
    expect(result.data?.highlights?.[0]).toEqual(stock);
    expect(result.data?.etfHighlights?.[0]).toEqual(etf);
  });

  it("leaves omitted highlight arrays and fields undefined", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      isPreview: false, previewReason: null, data: { highlights: [{}] },
    }));
    const result = await client.options.getOverview();
    expect(result.data?.etfHighlights).toBeUndefined();
    for (const field of ["ticker", "contract", "type", "strike", "expiry", "dte",
      "volume", "oi", "volOiRatio", "premium", "premiumPctl1y", "oiPrior",
      "oiNext", "oiChange", "oiConfirmation", "oiObservedAt", "oiVintage",
      "asOf", "publishedAt", "session"] as const) {
      expect(result.data?.highlights?.[0][field]).toBeUndefined();
    }
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

describe("options dossier fields", () => {
  it("keeps open-interest follow-up and premium fields on summary and history", async () => {
    const followUp = {
      oiPrior: 100, oiNext: 650, oiChange: 550, oiConfirmation: "opened" as const,
      oiObservedAt: 1787335200, oiVintage: "next_session" as const,
    };
    mockFetch.mockResolvedValueOnce(jsonResponse({
      isPreview: false, previewReason: null,
      data: {
        latest: { maxUnusualPremium: 19321974 },
        context: { unusualPremiumPctl1y: 98.5 },
        unusual: [{ contract: "NVDA260821C00217500", ...followUp }],
      },
    }));
    const summary = await client.stocks.getOptionsSummary("NVDA");
    expect(summary.data?.latest?.maxUnusualPremium).toBe(19321974);
    expect(summary.data?.context?.unusualPremiumPctl1y).toBe(98.5);
    for (const field of ["oiPrior", "oiNext", "oiChange", "oiConfirmation",
      "oiObservedAt", "oiVintage"] as const) {
      expect(summary.data?.unusual?.[0][field]).toBe(followUp[field]);
    }

    mockFetch.mockResolvedValueOnce(jsonResponse({
      isPreview: false, previewReason: null,
      data: { ticker: "NVDA", window: "1y", series: [
        { maxUnusualPremium: 19321974 }, {},
      ] },
    }));
    const history = await client.stocks.getOptionsHistory("NVDA");
    expect(history.data?.series?.[0].maxUnusualPremium).toBe(19321974);
    expect(history.data?.series?.[1].maxUnusualPremium).toBeUndefined();
  });

  it("leaves omitted follow-up and premium fields undefined", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      isPreview: false, previewReason: null,
      data: { latest: {}, context: {}, unusual: [{}] },
    }));
    const summary = await client.stocks.getOptionsSummary("NVDA");
    expect(summary.data?.latest?.maxUnusualPremium).toBeUndefined();
    expect(summary.data?.context?.unusualPremiumPctl1y).toBeUndefined();
    for (const field of ["oiPrior", "oiNext", "oiChange", "oiConfirmation",
      "oiObservedAt", "oiVintage"] as const) {
      expect(summary.data?.unusual?.[0][field]).toBeUndefined();
    }
  });
});

// ── Intraday session fields, against captured live responses ─────────────────
//
// The fixtures are real responses captured during a trading session and trimmed to a few
// rows. The key lists below are checked against the interfaces by the type checker
// (`satisfies Record<keyof T, true>` rejects a missing or an extra key), so the runtime
// check that every wire key appears in a list is a check that the interface declares it.

function fixture(name: string): { data: Record<string, any> } {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8"),
  );
}

function undeclared(wire: Record<string, unknown>, keys: Record<string, true>): string[] {
  return Object.keys(wire).filter((k) => !(k in keys));
}

const SUMMARY_KEYS = {
  asOf: true, sentiment: true, latest: true, context: true, oiWalls: true, unusual: true,
  intradayFlow: true, largePrintCount: true, largestPrintPctl: true, capabilities: true,
} satisfies Record<keyof OptionsSummary, true>;

const FLOW_KEYS = {
  unusualCount: true, firstSeenEt: true, firstSeenAt: true, flowPctl1y: true, asOfEt: true,
  asOf: true, live: true, delayMinutes: true,
} satisfies Record<keyof OptionsIntradayFlow, true>;

const CAPABILITIES_KEYS = { intradayBoard: true } satisfies Record<keyof OptionsCapabilities, true>;

const BOARD_KEYS = {
  available: true, access: true, apiData: true, delayMinutes: true, url: true,
} satisfies Record<keyof OptionsIntradayBoardCapability, true>;

const OVERVIEW_KEYS = {
  asOf: true, medianIvRank: true, marketPcVol: true, extremeCount: true, coverageCount: true,
  rows: true, etfRows: true, highlights: true, etfHighlights: true, etfMedianIvRank: true,
  etfMarketPcVol: true, etfExtremeCount: true, etfCoverageCount: true, etfTotalCount: true,
  builtAt: true, highlightPolicy: true, etfHighlightPolicy: true, intradayActiveCount: true,
  intradayRanking: true, capabilities: true,
} satisfies Record<keyof OptionsOverview, true>;

const AGGREGATE_KEYS = {
  date: true, callVol: true, putVol: true, callOi: true, putOi: true, pcVol: true, pcOi: true,
  vwIv: true, atmIv: true, skew25d: true, atmIv60: true, atmIv90: true, iv25c: true,
  iv25p: true, expectedMove1d: true, expectedMove5d: true, expectedMove20d: true,
  expectedMove1s1d: true, expectedMove1s5d: true, expectedMove1s20d: true, netDelta: true,
  notionalVol: true, contracts: true, maxUnusualPremium: true, maxUnusualPremiumEx0dte: true,
  unusualOi: true,
} satisfies Record<keyof OptionsAggregate, true>;

const FOLLOW_UP_KEYS = {
  contract: true, oiPrior: true, oiNext: true, oiChange: true, oiConfirmation: true,
  oiObservedAt: true, oiVintage: true,
} satisfies Record<keyof OptionsOiFollowUp, true>;

describe("options intraday session fields", () => {
  it("declares every field the live dossier sends", async () => {
    const payload = fixture("options_summary_live.json");
    const wire = payload.data;
    expect(undeclared(wire, SUMMARY_KEYS)).toEqual([]);
    expect(undeclared(wire.intradayFlow, FLOW_KEYS)).toEqual([]);
    expect(undeclared(wire.capabilities, CAPABILITIES_KEYS)).toEqual([]);
    expect(undeclared(wire.capabilities.intradayBoard, BOARD_KEYS)).toEqual([]);
    expect(undeclared(wire.latest, AGGREGATE_KEYS)).toEqual([]);

    mockFetch.mockResolvedValueOnce(jsonResponse(payload));
    const summary = await client.stocks.getOptionsSummary("NVDA");
    const flow: OptionsIntradayFlow | undefined = summary.data?.intradayFlow;
    expect(flow?.unusualCount).toBe(5);
    expect(flow?.firstSeenEt).toBe("10:14 ET");
    expect(typeof flow?.firstSeenAt).toBe("number");
    // The board's asOf is epoch seconds; the dossier's own asOf stays an ISO date.
    expect(typeof flow?.asOf).toBe("number");
    expect(typeof summary.data?.asOf).toBe("string");
    expect(flow?.live).toBe(true);
    expect(flow?.delayMinutes).toBe(15);
    expect(flow?.flowPctl1y).toBeUndefined();
    expect(summary.data?.largePrintCount).toBe(25);
    expect(summary.data?.largestPrintPctl).toBeUndefined();
    const board = summary.data?.capabilities?.intradayBoard;
    expect(board?.apiData).toBe(false);
    expect(board?.access).toBe("signed_in_pro");
    expect(board?.url).toBe("https://app.sentisense.ai/options");
  });

  it("declares every top-level field the live radar sends", async () => {
    const payload = fixture("options_overview_live.json");
    const wire = payload.data;
    expect(undeclared(wire, OVERVIEW_KEYS)).toEqual([]);
    expect(undeclared(wire.capabilities.intradayBoard, BOARD_KEYS)).toEqual([]);

    mockFetch.mockResolvedValueOnce(jsonResponse(payload));
    const overview = await client.options.getOverview();
    expect(overview.data?.intradayActiveCount).toBe(107);
    const ranking: string[] | undefined = overview.data?.intradayRanking;
    expect(ranking).toHaveLength(25);
    expect(ranking?.every((t) => typeof t === "string")).toBe(true);
    expect(overview.data?.highlightPolicy).toBe("ex0dte-v1");
    expect(overview.data?.etfHighlightPolicy).toBe("ex0dte-v1");
    expect(typeof overview.data?.builtAt).toBe("number");
    expect(overview.data?.capabilities?.intradayBoard?.apiData).toBe(false);
  });

  it("declares the ex0dte premium and open-interest follow-up on history rows", async () => {
    const payload = fixture("options_history_live.json");
    const [older, newer] = payload.data.series;
    for (const row of payload.data.series) {
      expect(undeclared(row, AGGREGATE_KEYS)).toEqual([]);
    }
    for (const entry of newer.unusualOi) {
      expect(undeclared(entry, FOLLOW_UP_KEYS)).toEqual([]);
    }
    expect(older.unusualOi).toBeUndefined();

    mockFetch.mockResolvedValueOnce(jsonResponse(payload));
    const history = await client.stocks.getOptionsHistory("NVDA");
    const followUp: OptionsOiFollowUp[] | undefined = history.data?.series?.[1].unusualOi;
    expect(followUp?.length).toBeGreaterThan(0);
    expect(history.data?.series?.[1].maxUnusualPremiumEx0dte).toBeGreaterThan(0);
    expect(history.data?.series?.[0].maxUnusualPremiumEx0dte).toBeUndefined();
  });

  it("leaves the intraday fields undefined when the server omits them", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      isPreview: false, previewReason: null, data: { asOf: "2026-09-29" },
    }));
    const summary = await client.stocks.getOptionsSummary("NVDA");
    for (const field of ["intradayFlow", "largePrintCount", "largestPrintPctl",
      "capabilities"] as const) {
      expect(summary.data?.[field]).toBeUndefined();
    }
  });
});
