import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { QUOTE_NVDA, routeFetch, run } from "./harness.js";

/**
 * The options command's views: the market-wide Radar with no ticker, a ticker's daily history,
 * and the dossier's --full additions. Fixtures are hand-built with fixed values, so a failing
 * line is a statement about the layout rather than about the day the test ran.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

const KEYED = { SENTISENSE_API_KEY: "ssk_test" };

function fixture(name: string): any {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8"));
}

/** `count` ranked rows, highest interest score first, ticker S01, S02, ... */
function boardRows(prefix: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ticker: `${prefix}${String(i + 1).padStart(2, "0")}`,
    name: `${prefix === "E" ? "Example Fund" : "Example Company"} ${i + 1}`,
    sector: prefix === "E" ? "Equity" : "Technology",
    asOf: "2026-11-17",
    sentiment: i % 2 === 0 ? 0.25 : -0.4,
    interestScore: 95 - i,
    pcVol: 0.61,
    pcVolPctl1y: 88.4,
    atmIv: 0.52,
    ivRank1y: 71.2,
    skew25d: 0.0312,
    skewPctl1y: 64.5,
    notionalVol: 812000000,
  }));
}

const HIGHLIGHT = {
  ticker: "S01",
  contract: "S01261120C00200000",
  type: "call",
  strike: 200,
  expiry: "2026-11-20",
  dte: 3,
  volume: 15000,
  oi: 89,
  volOiRatio: 168.5,
  premium: 27500000,
  premiumPctl1y: 98.1,
  asOf: "2026-11-17",
  session: "completed",
};

const ETF_HIGHLIGHT = { ...HIGHLIGHT, ticker: "E01", contract: "E01261120P00500000", type: "put" };

/** A PRO-shaped overview: every row served, so no `totalCount`. */
function overview(stockRows: number, etfRows: number) {
  return {
    isPreview: false,
    previewReason: null,
    data: {
      asOf: "2026-11-17",
      medianIvRank: 36.4871,
      marketPcVol: 0.5663,
      extremeCount: 4,
      coverageCount: stockRows,
      rows: boardRows("S", stockRows),
      etfRows: boardRows("E", etfRows),
      etfMedianIvRank: 35.1247,
      etfMarketPcVol: 0.556,
      etfExtremeCount: 1,
      etfCoverageCount: etfRows,
      highlights: [HIGHLIGHT],
      etfHighlights: [ETF_HIGHLIGHT],
    },
  };
}

/** A FREE key's cut: the top 25 rows and top 3 highlights of each board, full counts kept. */
function freeOverview() {
  return {
    isPreview: true,
    previewReason: "PRO_REQUIRED",
    upgrade: { plan: "PRO", url: "https://app.sentisense.ai/pricing" },
    totalCount: 1039,
    data: {
      ...overview(25, 25).data,
      coverageCount: 1039,
      extremeCount: 177,
      etfCoverageCount: 101,
      etfTotalCount: 101,
    },
  };
}

/** `count` daily sessions, oldest first, as the history route serves them. */
function historySeries(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
    return {
      date: day,
      callVol: 1000000 + i * 1000,
      putVol: 600000 + i * 1000,
      callOi: 7650000,
      putOi: 6630000,
      pcVol: 0.6,
      atmIv: 0.3124,
      skew25d: 0.0293,
      maxUnusualPremium: 34333975,
    };
  });
}

function historyEnvelope(count: number, window = "1y") {
  return { isPreview: false, previewReason: null, data: { ticker: "NVDA", window, series: historySeries(count) } };
}

describe("options Radar (no ticker)", () => {
  it("prints the stock board's aggregates, ranked rows and highlights", async () => {
    const result = await run(["options", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/\/options\/overview/, overview(18, 2)]]),
    });
    expect(result.code).toBe(0);
    expect(result.urls).toHaveLength(1);
    expect(result.urls[0]).toContain("/api/v1/options/overview");
    expect(result.stdout).toContain("board:   Options Radar, stocks");
    expect(result.stdout).toContain("session: 2026-11-17");
    expect(result.stdout).toContain("Median IV rank:      36.5");
    expect(result.stdout).toContain("Market put/call:     0.57");
    expect(result.stdout).toContain("Names at an extreme: 4 of 18");
    expect(result.stdout).toContain("TICKER");
    expect(result.stdout).toContain(
      " #  TICKER  NAME                SCORE   SENT   P/C  P/C PCTL  IV RANK     SKEW  SKEW PCTL  NOTIONAL\n" +
        " 1  S01     Example Company 1    95.0  +0.25  0.61      88.4     71.2  +0.0312       64.5      812M\n",
    );
    expect(result.stdout).toContain("S15");
    expect(result.stdout).not.toContain("S16");
    // The two boards are never merged.
    expect(result.stdout).not.toContain("E01  Example Fund");
    expect(result.stdout).toContain("Showing 15 of 18 names. Add --full, or --limit N, for more.");
    expect(result.stdout).toContain("Session highlights, each ticker's highest-premium unusual contract:");
    expect(result.stdout).toContain("S01261120C00200000");
    expect(result.stdout).toContain("27.5M");
    expect(result.stdout).toContain("The ETF board is ranked separately: add --etfs.");
    expect(result.stdout).not.toContain("Preview response");
  });

  it("--etfs shows the ETF board with its own aggregates and highlights", async () => {
    const result = await run(["options", "--etfs", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/\/options\/overview/, overview(18, 2)]]),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("board:   Options Radar, ETFs");
    expect(result.stdout).toContain("Median IV rank:      35.1");
    expect(result.stdout).toContain("Market put/call:     0.56");
    expect(result.stdout).toContain("Names at an extreme: 1 of 2");
    expect(result.stdout).toContain("E02");
    expect(result.stdout).toContain("E01261120P00500000");
    expect(result.stdout).not.toContain("S01");
    expect(result.stdout).not.toContain("Showing");
    expect(result.stdout).not.toContain("add --etfs");
  });

  it("--limit sets the rows printed and --full prints every served row", async () => {
    const limited = await run(["options", "--limit", "3", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/\/options\/overview/, overview(18, 2)]]),
    });
    expect(limited.code).toBe(0);
    expect(limited.stdout).toContain("S03");
    expect(limited.stdout).not.toContain("S04");
    expect(limited.stdout).toContain("Showing 3 of 18 names.");

    const everything = await run(["options", "--full", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/\/options\/overview/, overview(18, 2)]]),
    });
    expect(everything.stdout).toContain("S18");
    expect(everything.stdout).not.toContain("Showing");
  });

  it("answers a free preview, names both numbers and the cut, and exits 0", async () => {
    const stocks = await run(["options", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/\/options\/overview/, freeOverview()]]),
    });
    expect(stocks.code).toBe(0);
    expect(stocks.stdout).toContain("Names at an extreme: 177 of 1039");
    expect(stocks.stdout).toContain(
      "Showing 15 of 25 served; the full board has 1039 names. Add --full for every served row.",
    );
    expect(stocks.stdout).toContain(
      "Preview response: a free key gets the top 25 rows and the top 3 highlights of each board, with every aggregate. A PRO key gets the whole board.",
    );

    const wide = await run(["options", "--limit", "40", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/\/options\/overview/, freeOverview()]]),
    });
    expect(wide.stdout).toContain("Showing all 25 served; the full board has 1039 names.");

    const etfs = await run(["options", "--etfs", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/\/options\/overview/, freeOverview()]]),
    });
    expect(etfs.code).toBe(0);
    expect(etfs.stdout).toContain("Showing 15 of 25 served; the full board has 101 names.");
  });

  it("says there is no board yet when the payload is null, and exits 0", async () => {
    const envelope = { isPreview: false, previewReason: null, data: null };
    const result = await run(["options", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/\/options\/overview/, envelope]]),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(
      "No options board yet: the Radar is built after each session closes, and no build has been published.\n",
    );
    expect(result.urls.some((candidate) => candidate.includes("/quote"))).toBe(false);

    const asJson = await run(["options", "--json"], {
      env: KEYED,
      fetch: routeFetch([[/\/options\/overview/, envelope]]),
    });
    expect(JSON.parse(asJson.stdout)).toEqual(envelope);
  });

  it("says so when a build has no ETF board", async () => {
    const { etfRows: _rows, etfHighlights: _highlights, ...data } = overview(3, 0).data;
    const result = await run(["options", "--etfs", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/\/options\/overview/, { isPreview: false, previewReason: null, data }]]),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("This build has no ETF board.");
  });

  it("--json prints the whole overview envelope", async () => {
    const envelope = freeOverview();
    const result = await run(["options", "--etfs", "--json"], {
      env: KEYED,
      fetch: routeFetch([[/\/options\/overview/, envelope]]),
    });
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(envelope);
  });
});

describe("options --history", () => {
  it("prints the newest sessions first and says newest N of M in the served window", async () => {
    const result = await run(["options", "NVDA", "--history", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/stocks\/NVDA\/options\/history/, historyEnvelope(25)]]),
    });
    expect(result.code).toBe(0);
    const requested = new URL(result.urls[0]);
    expect(requested.pathname).toBe("/api/v1/stocks/NVDA/options/history");
    expect(requested.searchParams.has("window")).toBe(false);
    expect(result.urls.some((candidate) => candidate.includes("/options/summary"))).toBe(false);
    expect(result.stdout).toContain("window:   1y");
    expect(result.stdout).toContain("sessions: 25");
    expect(result.stdout).toContain("DATE        CALL VOL  PUT VOL   P/C  CALL OI  PUT OI  ATM IV     SKEW  MAX UNUSUAL");
    expect(result.stdout).toContain("2026-10-25        1M     624k  0.60     7.7M    6.6M  0.3124  +0.0293       34.33M");
    // Newest first: the last session leads, and the five oldest are left out.
    expect(result.stdout.indexOf("2026-10-25")).toBeLessThan(result.stdout.indexOf("2026-10-06"));
    expect(result.stdout).not.toContain("2026-10-05");
    expect(result.stdout).toContain("Newest 20 of 25 sessions in the 1y window. Add --full, or --limit N, for more.");
    expect(result.stdout).toContain("Open interest is the count going into each session, at the previous close.");
  });

  it("--limit changes how many sessions print", async () => {
    const result = await run(["options", "NVDA", "--history", "--limit", "5", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/stocks\/NVDA\/options\/history/, historyEnvelope(25)]]),
    });
    expect(result.stdout).toContain("2026-10-21");
    expect(result.stdout).not.toContain("2026-10-20");
    expect(result.stdout).toContain("Newest 5 of 25 sessions in the 1y window.");
  });

  it("sends the window asked for and prints the window served", async () => {
    // A free key is served 1y whatever it asks for, so the served window is what prints.
    const result = await run(["options", "NVDA", "--history", "--window", "5y", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/stocks\/NVDA\/options\/history/, historyEnvelope(3, "1y")]]),
    });
    expect(result.code).toBe(0);
    expect(new URL(result.urls[0]).searchParams.get("window")).toBe("5y");
    expect(result.stdout).toContain("window:   1y");
    expect(result.stdout).toContain("Newest 3 of 3 sessions in the 1y window.");
    expect(result.stdout).toContain(
      "Asked for 5y, served 1y: a free key is served 1y for every ticker except the sample companies.",
    );

    const honoured = await run(["options", "NVDA", "--history", "--window", "2y", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/stocks\/NVDA\/options\/history/, historyEnvelope(3, "2y")]]),
    });
    expect(honoured.stdout).toContain("in the 2y window.");
    expect(honoured.stdout).not.toContain("Asked for");
  });

  it("--window implies --history", async () => {
    const result = await run(["options", "NVDA", "--window", "2y", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/stocks\/NVDA\/options\/history/, historyEnvelope(2, "2y")]]),
    });
    expect(result.code).toBe(0);
    expect(new URL(result.urls[0]).pathname).toBe("/api/v1/stocks/NVDA/options/history");
    expect(result.urls.some((candidate) => candidate.includes("/options/summary"))).toBe(false);
  });

  it("rejects a window the route does not take, before any request", async () => {
    for (const window of ["3y", "1Y", "all"]) {
      const fetchMock = routeFetch([]);
      const result = await run(["options", "NVDA", "--history", "--window", window], { env: KEYED, fetch: fetchMock });
      expect(result.code).toBe(2);
      expect(result.stderr).toContain(`--window takes 1y, 2y or 5y, got "${window}".`);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });

  it("reports an empty series as no coverage and exits 0", async () => {
    const envelope = { isPreview: false, previewReason: null, data: { ticker: "KO", window: "1y", series: [] } };
    const result = await run(["options", "KO", "--history", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [/stocks\/KO\/options\/history/, envelope],
        [/\/stocks\/KO\/quote/, { ...QUOTE_NVDA, ticker: "KO" }],
      ]),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("No options coverage for KO.\n");
    expect(result.stderr).toBe("");

    const asJson = await run(["options", "KO", "--history", "--json"], {
      env: KEYED,
      fetch: routeFetch([
        [/stocks\/KO\/options\/history/, envelope],
        [/\/stocks\/KO\/quote/, { ...QUOTE_NVDA, ticker: "KO" }],
      ]),
    });
    expect(JSON.parse(asJson.stdout)).toEqual(envelope);
  });

  it("still exits 4 when the empty series was a symbol that does not exist", async () => {
    const result = await run(["options", "ZZZZZZ", "--history", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [/stocks\/ZZZZZZ\/options\/history/, { isPreview: false, previewReason: null, data: { ticker: "ZZZZZZ", window: "1y", series: [] } }],
      ]),
    });
    expect(result.code).toBe(4);
    expect(result.stderr).toContain('unknown ticker "ZZZZZZ"');
  });
});

describe("options dossier additions", () => {
  /** The captured live dossier, with the fields it predates filled in. */
  function fullDossier(envelope: Record<string, unknown> = {}) {
    const live = fixture("options_summary_live.json");
    live.data.context.unusualPremiumPctl1y = 91.3;
    live.data.oiWalls = {
      ...live.data.oiWalls,
      totalCallOi: 1250000,
      totalPutOi: 980000,
      maxPainCallOi: 42100,
      maxPainPutOi: 0,
    };
    live.data.unusual[0] = {
      ...live.data.unusual[0],
      oiNext: 9800,
      oiChange: 4688,
      oiConfirmation: "opened",
      oiVintage: "next_session",
    };
    return { ...live, ...envelope };
  }

  it("--full adds the follow-up, the wall totals, the extra percentiles and the 5 and 20 session moves", async () => {
    const result = await run(["options", "NVDA", "--full", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/stocks\/NVDA\/options\/summary/, fullDossier()]]),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("pc vol percentile 5y:          25.9");
    expect(result.stdout).toContain("put/call OI percentile 1y:     57.1");
    expect(result.stdout).toContain("unusual premium percentile 1y: 91.3");
    expect(result.stdout).toContain("exp move 5d:                   0.0686");
    expect(result.stdout).toContain("exp move 20d:                  0.1373");
    expect(result.stdout).toContain("wall expiry OI:                calls 1.3M   puts 980k");
    expect(result.stdout).toContain("OI at max pain:                calls 42.1k   puts 0");
    expect(result.stdout).toContain("Open interest follow-up on those contracts:\n");
    expect(result.stdout).toContain("CONTRACT             OI PRIOR  OI NEXT  OI CHANGE  FOLLOW-UP  VINTAGE");
    expect(result.stdout).toContain("NVDA260930P00230000      5.1k     9.8k      +4.7k  opened     next_session");
    // Not yet observed: the next session's open interest and the change are absent, not zero.
    expect(result.stdout).toContain("NVDA290119C00210000       650      n/a        n/a  pending    prior_settle");
  });

  it("does not date a follow-up the vintage resolved within the same session", async () => {
    // A revised observation of the same session (`settled`) fills the same fields as the next
    // session's chain, so the heading names neither and the vintage column says which.
    const envelope = fullDossier();
    envelope.data.unusual = [
      { contract: "XYZ261120C00012500", type: "call", strike: 12.5, oiPrior: 100, oiNext: 200,
        oiChange: 100, oiConfirmation: "opened", oiVintage: "settled" },
    ];
    const result = await run(["options", "XYZ", "--full", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/stocks\/XYZ\/options\/summary/, envelope]]),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain("next session");
    expect(result.stdout).toContain("XYZ261120C00012500       100      200       +100  opened     settled");
  });

  it("leaves the vintage column out when no row carries one", async () => {
    const envelope = fullDossier();
    envelope.data.unusual = [{ contract: "XYZ261120C00012500", type: "call", strike: 12, oiPrior: 100, oiConfirmation: "pending" }];
    const result = await run(["options", "XYZ", "--full", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/stocks\/XYZ\/options\/summary/, envelope]]),
    });
    expect(result.stdout).toContain("CONTRACT            OI PRIOR  OI NEXT  OI CHANGE  FOLLOW-UP\n");
    expect(result.stdout).not.toContain("VINTAGE");
  });

  it("prints fractional strikes in full and whole strikes as before", async () => {
    const envelope = fullDossier();
    envelope.data.oiWalls = { ...envelope.data.oiWalls, maxPain: 227.5, callWalls: [{ strike: 12.5, oi: 4200 }, { strike: 230, oi: 3100 }] };
    envelope.data.unusual = [
      { contract: "NVDA260930P00227500", type: "put", strike: 227.5, expiry: "2026-09-30", dte: 1 },
      { contract: "NVDA260930P00230000", type: "put", strike: 230, expiry: "2026-09-30", dte: 1 },
      { contract: "XYZ261120C00000500", type: "call", strike: 0.5, expiry: "2026-11-20", dte: 3 },
    ];
    const result = await run(["options", "NVDA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/stocks\/NVDA\/options\/summary/, envelope]]),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Max pain:    227.5\n");
    expect(result.stdout).toContain("call walls: 12.5 (4.2k)  230 (3.1k)\n");
    expect(result.stdout).toContain("CONTRACT             TYPE  STRIKE  EXPIRY      DTE");
    expect(result.stdout).toContain("NVDA260930P00227500  put    227.5  2026-09-30    1");
    expect(result.stdout).toContain("NVDA260930P00230000  put      230  2026-09-30    1");
    expect(result.stdout).toContain("XYZ261120C00000500   call     0.5  2026-11-20    3");
    expect(result.stdout).not.toContain(" 228 ");
  });

  it("keeps the lines --full printed before at their old alignment", async () => {
    const result = await run(["options", "NVDA", "--full", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/stocks\/NVDA\/options\/summary/, fullDossier()]]),
    });
    expect(result.stdout).toContain(
      [
        "term structure:       60d 0.3612   90d 0.3563",
        "net delta:            296.8M",
        "put/call OI:          0.87",
        "pc vol percentile 1y: 34.9",
        "skew percentile 1y:   45.6",
        "observations 1y:      252",
      ].join("\n"),
    );
  });

  it("leaves the --full additions out of the default view", async () => {
    const result = await run(["options", "NVDA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/stocks\/NVDA\/options\/summary/, fullDossier()]]),
    });
    expect(result.code).toBe(0);
    for (const line of ["pc vol percentile 5y", "wall expiry OI", "OI at max pain", "OI PRIOR", "exp move 20d"]) {
      expect(result.stdout).not.toContain(line);
    }
  });

  it("prints the allowance line on a free envelope, in both views", async () => {
    const envelope = fullDossier({ dossierAllowance: { limit: 10, remaining: 7, resetsAt: 1796101200 } });
    for (const argv of [["options", "NVDA", "--plain"], ["options", "NVDA", "--full", "--plain"]]) {
      const result = await run(argv, {
        env: KEYED,
        fetch: routeFetch([[/stocks\/NVDA\/options\/summary/, envelope]]),
      });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("7 of 10 full dossiers left this month, resets 2026-12-01.");
    }

    const asJson = await run(["options", "NVDA", "--json"], {
      env: KEYED,
      fetch: routeFetch([[/stocks\/NVDA\/options\/summary/, envelope]]),
    });
    expect(JSON.parse(asJson.stdout).dossierAllowance).toEqual({ limit: 10, remaining: 7, resetsAt: 1796101200 });
  });

  it("prints the spent allowance beside the headline preview", async () => {
    const result = await run(["options", "NVDA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [
          /stocks\/NVDA\/options\/summary/,
          {
            isPreview: true,
            previewReason: "PRO_REQUIRED",
            upgrade: { plan: "PRO", url: "https://app.sentisense.ai/pricing" },
            dossierAllowance: { limit: 10, remaining: 0, resetsAt: 1793505600 },
            data: { asOf: "2026-09-28", sentiment: 0.2, ivRank1y: 45, atmIv: 0.4, pcVol: 0.7, maxPain: 150 },
          },
        ],
      ]),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("only the headline readings are shown");
    expect(result.stdout).toContain("0 of 10 full dossiers left this month, resets 2026-11-01.");
  });

  it("prints no allowance line on a PRO envelope", async () => {
    for (const argv of [["options", "NVDA", "--plain"], ["options", "NVDA", "--full", "--plain"]]) {
      const result = await run(argv, {
        env: KEYED,
        fetch: routeFetch([[/stocks\/NVDA\/options\/summary/, fullDossier()]]),
      });
      expect(result.stdout).not.toContain("full dossiers left");
    }
  });

  it("marks a delisted dossier, with and without the date, in both views", async () => {
    const payloads = fixture("response_additions.json");
    for (const argv of [["options", "EA", "--plain"], ["options", "EA", "--full", "--plain"]]) {
      const dated = await run(argv, {
        env: KEYED,
        fetch: routeFetch([[/stocks\/EA\/options\/summary/, payloads.optionsDelisted]]),
      });
      expect(dated.code).toBe(0);
      expect(dated.stdout).toContain("EA is delisted (2026-08-05): this is the last dossier on record, as of 2026-08-04.");

      const undated = await run(argv, {
        env: KEYED,
        fetch: routeFetch([[/stocks\/EA\/options\/summary/, payloads.optionsDelistedUnknownDate]]),
      });
      expect(undated.stdout).toContain("EA is delisted: this is the last dossier on record, as of 2026-08-04.");

      const listed = await run(argv, {
        env: KEYED,
        fetch: routeFetch([[/stocks\/EA\/options\/summary/, payloads.optionsListed]]),
      });
      expect(listed.stdout).not.toContain("delisted");
    }
  });

  it("dates a delisted dossier by its own asOf, never as the final session", async () => {
    // The last stored snapshot can predate the delisting: the server serves what it has and
    // adds the marker, so the line names the snapshot's date and claims nothing more.
    const stale = {
      isPreview: false,
      previewReason: null,
      data: { asOf: "2026-11-12", sentiment: 0.1, listingStatus: "DELISTED", delistedDate: "2026-11-17" },
    };
    const result = await run(["options", "EA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/stocks\/EA\/options\/summary/, stale]]),
    });
    expect(result.stdout).toContain("EA is delisted (2026-11-17): this is the last dossier on record, as of 2026-11-12.");
    expect(result.stdout).not.toContain("last trading session");
    expect(result.stdout).not.toContain("frozen");

    const undated = { ...stale, data: { sentiment: 0.1, listingStatus: "DELISTED", delistedDate: "2026-11-17" } };
    const noAsOf = await run(["options", "EA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/stocks\/EA\/options\/summary/, undated]]),
    });
    expect(noAsOf.stdout).toContain("EA is delisted (2026-11-17): this is the last dossier on record.\n");
  });
});

describe("options dossier scale legend", () => {
  const LEGEND =
    "positioning runs -1 to +1; IV rank 0 to 100; ATM IV, expected move and skew are fractions (0.05 is 5%, or 5 IV points for skew).";

  /** A synthetic dossier: round illustrative values, one wall per side, one unusual contract. */
  const DOSSIER = {
    isPreview: false,
    previewReason: null,
    data: {
      asOf: "2026-01-02",
      sentiment: 0.25,
      latest: {
        date: "2026-01-02",
        pcVol: 0.5,
        atmIv: 0.4,
        expectedMove1d: 0.03,
        skew25d: 0.02,
        callVol: 1000,
        putVol: 500,
        notionalVol: 1000000,
        callOi: 4000,
        putOi: 2000,
        contracts: 100,
      },
      context: { ivRank1y: 50 },
      oiWalls: { expiry: "2026-01-16", maxPain: 100, callWalls: [{ strike: 110, oi: 900 }], putWalls: [{ strike: 90, oi: 700 }] },
      unusual: [
        { contract: "EXMP260116C00110000", type: "call", strike: 110, expiry: "2026-01-16", dte: 14, volume: 500, oi: 50, volOiRatio: 10, premium: 25000 },
      ],
    },
  };

  const route = (payload: unknown) => routeFetch([[/stocks\/EXMP\/options\/summary/, payload]]);

  it("prints one legend line under the readings, before the unusual contracts", async () => {
    const result = await run(["options", "EXMP", "--plain"], { env: KEYED, fetch: route(DOSSIER) });
    expect(result.code).toBe(0);
    expect(result.stdout.split(LEGEND)).toHaveLength(2);
    const lines = result.stdout.split("\n");
    const at = lines.indexOf(LEGEND);
    expect(lines[at - 1]).toMatch(/^put walls:/);
    expect(lines.slice(at + 1, at + 3)).toEqual(["", expect.stringMatching(/^CONTRACT /)]);
    // The readings themselves print as they always did: bare numbers, no units added.
    expect(result.stdout).toContain("positioning:  +0.25\n");
    expect(result.stdout).toContain("iv rank 1y:   50.0\n");
    expect(result.stdout).toContain("ATM IV:      0.4000\n");
    expect(result.stdout).toContain("Exp move 1d: 0.0300\n");
    expect(result.stdout).toContain("Skew 25d:    +0.0200\n");
  });

  it("sits under the --full readings too, and beside a headline preview", async () => {
    const full = await run(["options", "EXMP", "--full", "--plain"], { env: KEYED, fetch: route(DOSSIER) });
    expect(full.stdout).toMatch(/\nOI at max pain:[^\n]*\npositioning runs -1 to \+1;/);
    expect(full.stdout.split(LEGEND)).toHaveLength(2);

    const preview = await run(["options", "EXMP", "--plain"], {
      env: KEYED,
      fetch: route({
        isPreview: true,
        previewReason: "PRO_REQUIRED",
        data: { asOf: "2026-01-02", sentiment: 0.2, ivRank1y: 45, atmIv: 0.4, pcVol: 0.7, maxPain: 150 },
      }),
    });
    expect(preview.stdout).toContain(`put walls:  n/a\n${LEGEND}\n`);
  });

  it("leaves --json untouched and prints no legend for a ticker with no coverage", async () => {
    const asJson = await run(["options", "EXMP", "--json"], { env: KEYED, fetch: route(DOSSIER) });
    expect(JSON.parse(asJson.stdout)).toEqual(DOSSIER);
    expect(asJson.stdout).not.toContain("positioning runs");

    const empty = await run(["options", "NVDA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [/stocks\/NVDA\/options\/summary/, { isPreview: false, previewReason: null, data: null }],
        [/\/stocks\/NVDA\/quote/, QUOTE_NVDA],
      ]),
    });
    expect(empty.stdout).not.toContain("positioning runs");
  });
});

describe("options flags that do not go together", () => {
  const CASES: Array<[string[], string]> = [
    [["options", "NVDA", "--history", "--intraday"], "--history and --intraday do not go together."],
    [["options", "NVDA", "--window", "2y", "--session", "2026-10-14"], "--window and --session do not go together."],
    [["options", "--history"], "--history needs a ticker."],
    [["options", "--window", "1y"], "--window needs a ticker."],
    [["options", "--intraday"], "--intraday needs a ticker."],
    [["options", "--session", "2026-10-14"], "--session needs a ticker."],
    [["options", "NVDA", "--etfs"], "--etfs picks the Radar's ETF board, which takes no ticker."],
    [["options", "--etfs", "--history"], "--etfs and --history do not go together."],
    [["options", "--etfs", "--intraday"], "--etfs and --intraday do not go together."],
    [["options", "NVDA", "--limit", "5"], "--limit applies to the Radar and to --history."],
    [["options", "NVDA", "--intraday", "--limit", "5"], "--limit applies to the Radar and to --history."],
    [["options", "--limit", "0"], "--limit must be a whole number, at least 1."],
    [["options", "--limit", "2.5"], "--limit must be a whole number, at least 1."],
    [["options", "NVDA", "AAPL", "--history"], "options takes one ticker, and got 2"],
    // An explicitly empty ticker, as from an unset "$TICKER", is not a request for the Radar.
    [["options", ""], "options needs a ticker."],
    [["options", "   "], "options needs a ticker."],
    [["options", "", "--plain"], "options needs a ticker."],
  ];

  for (const [argv, message] of CASES) {
    it(`${JSON.stringify(argv.slice(1))} is a usage error before any request`, async () => {
      const fetchMock = routeFetch([]);
      const result = await run(argv, { env: KEYED, fetch: fetchMock });
      expect(result.code).toBe(2);
      expect(result.stderr).toContain(message);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }

  it("treats zero positionals as the Radar, unlike an empty one", async () => {
    const result = await run(["options", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/\/options\/overview/, overview(3, 0)]]),
    });
    expect(result.code).toBe(0);
    expect(result.urls).toHaveLength(1);
    expect(result.urls[0]).toContain("/api/v1/options/overview");
  });
});

describe("options help", () => {
  it("names the new views and their flags", async () => {
    const result = await run(["help", "options"], {});
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("With no ticker it prints the Radar");
    expect(result.stdout).toContain("--etfs");
    expect(result.stdout).toContain("--history");
    expect(result.stdout).toContain("--window <1y|2y|5y>");
    expect(result.stdout).toContain("--limit <N>");
    expect(result.stdout).toContain("sentisense options --etfs --limit 25");
    expect(result.stdout).toContain("sentisense options NVDA --history --window 2y");
  });

  it("says --limit and --etfs do not trim --json", async () => {
    const result = await run(["help", "options"], {});
    expect(result.stdout).toContain(
      "--limit and --etfs choose what the plain view prints; they do not trim --json, which prints\n" +
        "the whole API response: for the Radar that is both boards and every served row, a large body.\n",
    );
  });

  it("names a session that has stored intraday history in its examples", async () => {
    const result = await run(["help", "options"], {});
    expect(result.stdout).toContain("  sentisense options SPY --session 2026-10-15\n");
    expect(result.stdout).not.toContain("2026-10-14");

    const missingTicker = await run(["options", "--session", "2026-10-15"], { env: KEYED });
    expect(missingTicker.code).toBe(2);
    expect(missingTicker.stderr).toContain("sentisense options NVDA --session 2026-10-15");
    expect(missingTicker.stderr).not.toContain("2026-10-14");

    const badDate = await run(["options", "NVDA", "--session", "bad"], { env: KEYED });
    expect(badDate.code).toBe(2);
    expect(badDate.stderr).toContain("for example: --session 2026-10-15");
  });

  it("names the Radar in the command map", async () => {
    const result = await run(["--help"], {});
    expect(result.stdout).toContain("End-of-day options: the market Radar, or one stock or ETF's positioning and history");
  });
});
