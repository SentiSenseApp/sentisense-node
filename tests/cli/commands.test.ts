import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MARKET_STATUS,
  MOOD,
  PROFILE_NVDA,
  QUOTE_NVDA,
  SENTIMENT_NVDA,
  routeFetch,
  run,
} from "./harness.js";
import { readConfig } from "../../src/cli/config.js";
import { latestSettledQuarter } from "../../src/cli/commands/flows.js";
import { VERSION } from "../../src/version.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const KEYED = { SENTISENSE_API_KEY: "ssk_test" };
const preview = <T>(data: T) => ({ isPreview: false, previewReason: null, data });

function url(result: { urls: string[] }, fragment: string): string {
  const found = result.urls.find((candidate) => candidate.includes(fragment));
  if (!found) throw new Error(`no request matched ${fragment}: ${result.urls.join(", ")}`);
  return found;
}

describe("command wiring", () => {
  it("quote spends one request per ticker when nobody is reading the name", async () => {
    // A pipe and a parser do not need the display name, and a free key at 30 requests a
    // minute should not pay double for it.
    const result = await run(["quote", "NVDA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [/\/stocks\/NVDA\/quote/, QUOTE_NVDA],
        [/\/stocks\/NVDA\/profile/, PROFILE_NVDA],
      ]),
    });
    expect(result.code).toBe(0);
    expect(url(result, "/api/v1/stocks/NVDA/quote")).toContain("app.sentisense.ai");
    expect(result.urls).toHaveLength(1);
    expect(result.urls.some((candidate) => candidate.includes("/profile"))).toBe(false);
  });

  it("quote skips the profile for --json too", async () => {
    const result = await run(["quote", "NVDA", "--json"], {
      env: KEYED,
      fetch: routeFetch([
        [/\/stocks\/NVDA\/quote/, QUOTE_NVDA],
        [/\/stocks\/NVDA\/profile/, PROFILE_NVDA],
      ]),
    });
    expect(result.urls).toHaveLength(1);
  });

  it("quote fetches the name for the terminal layout", async () => {
    const result = await run(["quote", "NVDA"], {
      env: KEYED,
      isTTY: true,
      fetch: routeFetch([
        [/\/stocks\/NVDA\/quote/, QUOTE_NVDA],
        [/\/stocks\/NVDA\/profile/, PROFILE_NVDA],
      ]),
    });
    expect(result.urls).toHaveLength(2);
    expect(url(result, "/api/v1/stocks/NVDA/profile")).toBeDefined();
    expect(result.stdout).toContain("NVIDIA Corporation");
  });

  it("quote still answers when the profile lookup fails", async () => {
    const result = await run(["quote", "NVDA", "--pretty"], {
      env: KEYED,
      fetch: routeFetch([[/\/stocks\/NVDA\/quote/, QUOTE_NVDA]]),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("NVDA");
    expect(result.stdout).not.toContain("NVIDIA Corporation");
  });

  it("sentiment asks for the Score series over the requested window", async () => {
    const result = await run(["sentiment", "NVDA", "--days", "90", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [/\/stocks\/NVDA\/sentiment/, SENTIMENT_NVDA],
        [/\/metrics\/entity\/NVDA/, []],
      ]),
    });
    expect(result.code).toBe(0);
    const metrics = url(result, "/api/v2/metrics/entity/NVDA");
    expect(metrics).toContain("/metric/sentisense_score");
    expect(metrics).toContain("maxDataPoints=90");
  });

  it("mood reads the market mood index", async () => {
    const result = await run(["mood", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/market-mood/, MOOD]]),
    });
    expect(result.code).toBe(0);
    expect(url(result, "/api/v2/market-mood")).toBeDefined();
  });

  it("analysts reads consensus and recent actions", async () => {
    const result = await run(["analysts", "NVDA", "--days", "180", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [
          /\/analyst\/NVDA\/consensus/,
          preview({
            ticker: "NVDA",
            currentPrice: 182.14,
            targetLow: 150,
            targetMean: 210,
            targetHigh: 260,
            targetMedian: 205,
            numberOfAnalysts: 58,
            upsidePercent: 15.3,
            consensusLabel: "Buy",
            recommendationMean: 1.4,
            strongBuy: 30,
            buy: 20,
            hold: 6,
            sell: 1,
            strongSell: 1,
            updatedAt: "2026-08-18",
          }),
        ],
        [
          /\/analyst\/NVDA\/actions/,
          preview([
            {
              ticker: "NVDA",
              actionDate: "2026-08-18",
              firm: "Example Research",
              actionType: "UPGRADE",
              fromGrade: "Hold",
              toGrade: "Buy",
            },
          ]),
        ],
      ]),
    });
    expect(result.code).toBe(0);
    expect(url(result, "/analyst/NVDA/actions")).toContain("lookbackDays=180");
    expect(result.stdout).toContain("Example Research");
  });

  it("earnings with no ticker reads the forward calendar", async () => {
    const result = await run(["earnings", "--week", "next", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [
          /calendar\/earnings/,
          preview({
            earnings: [
              {
                ticker: "NVDA",
                companyName: "NVIDIA Corporation",
                earningsDate: "2026-08-26",
                earningsTime: "after_close",
                fiscalQuarter: "Q2 2027",
                confirmed: true,
                estimatedEps: 1.24,
              },
            ],
            metadata: {
              generatedAt: 1787169600,
              windowStart: "2026-08-24",
              windowEnd: "2026-08-30",
              count: 1,
              source: "sentisense",
            },
          }),
        ],
      ]),
    });
    expect(result.code).toBe(0);
    expect(url(result, "/api/v1/calendar/earnings")).toContain("week=next");
    expect(result.stdout).toContain("2026-08-26");
  });

  it("earnings with a ticker reads the per-quarter analysis", async () => {
    const result = await run(["earnings", "NVDA", "--limit", "2", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [
          /earnings-summaries/,
          preview([
            {
              fiscalPeriod: "Q1 FY2027",
              reportDate: "2026-05-27",
              headline: "Data centre revenue set another record",
              hasTranscript: true,
              generatedAt: 1780000000,
              source: "press_release",
            },
          ]),
        ],
      ]),
    });
    expect(result.code).toBe(0);
    expect(url(result, "/stocks/NVDA/earnings-summaries")).toContain("limit=2");
    expect(result.stdout).toContain("Q1 FY2027");
  });

  it("insiders reads filed transactions for the ticker", async () => {
    const result = await run(["insiders", "NVDA", "--days", "30", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [
          /insider\/trades\/NVDA/,
          preview([
            {
              ticker: "NVDA",
              companyName: "NVIDIA Corporation",
              insiderName: "A Director",
              insiderTitle: "Director",
              insiderRelation: "DIRECTOR",
              officer: false,
              director: true,
              tenPctOwner: false,
              transactionDate: "2026-08-14",
              filedDate: "2026-08-16",
              transactionCode: "S",
              transactionType: "SELL",
              securityTitle: "Common Stock",
              sharesTransacted: 12000,
              pricePerShare: 180.2,
              totalValue: 2162400,
              sharesOwnedAfter: 40000,
              directOwnership: true,
              rule10b51: true,
            },
          ]),
        ],
      ]),
    });
    expect(result.code).toBe(0);
    expect(url(result, "/insider/trades/NVDA")).toContain("lookbackDays=30");
    expect(result.stdout).toContain("10b5-1");
  });

  it("insights passes the urgency filter through", async () => {
    const result = await run(["insights", "NVDA", "--urgency", "high", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [
          /insights\/stock\/NVDA/,
          preview([
            {
              insightType: "insider_buy_signal",
              insightText: "Three officers bought in the same week.",
              confidence: 0.82,
              urgency: "high",
              generatedAt: 1787000000,
            },
          ]),
        ],
      ]),
    });
    expect(result.code).toBe(0);
    expect(url(result, "/insights/stock/NVDA")).toContain("urgency=high");
    expect(result.stdout).toContain("insider_buy_signal");
  });

  it("insights rejects an urgency the API does not accept", async () => {
    const result = await run(["insights", "NVDA", "--urgency", "urgent"], { env: KEYED });
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("low, medium, or high");
  });

  it("congress reads the market-wide feed with no ticker", async () => {
    const result = await run(["congress", "--limit", "5", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/politicians\/activity/, preview([])]]),
    });
    expect(result.code).toBe(0);
    expect(url(result, "/api/v1/politicians/activity")).toContain("limit=5");
  });

  it("congress reads one ticker's filings when given a symbol", async () => {
    const result = await run(["congress", "NVDA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/politicians\/filings\/NVDA/, preview([])]]),
    });
    expect(result.code).toBe(0);
    expect(url(result, "/politicians/filings/NVDA")).toBeDefined();
  });

  it("news reads the ticker story feed when given a symbol", async () => {
    const result = await run(["news", "NVDA", "--limit", "3", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [
          /documents\/stories\/ticker\/NVDA/,
          [
            {
              cluster: {
                id: "cluster-1",
                title: "Chip demand keeps climbing",
                clusterSize: 14,
                averageSentiment: 0.31,
                clusteredAt: 1787100000,
              },
              displayTickers: ["NVIDIA Corp (NVDA)"],
              tickers: ["NVDA"],
              primaryEntityNames: ["NVIDIA Corporation"],
              impactScore: 8.4,
              brokeAt: 1787090000,
            },
          ],
        ],
      ]),
    });
    expect(result.code).toBe(0);
    expect(url(result, "/documents/stories/ticker/NVDA")).toContain("limit=3");
    expect(result.stdout).toContain("Chip demand keeps climbing");
  });

  it("flows with no ticker reads the market-wide quarter", async () => {
    const result = await run(["flows", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [/institutional\/flows/, preview({ inflows: [], outflows: [], reportDate: "2026-06-30" })],
      ]),
    });
    expect(result.code).toBe(0);
    expect(url(result, "/api/v1/institutional/flows")).toContain("limit=10");
  });

  it("flows with a ticker resolves the latest settled quarter before reading holders", async () => {
    const result = await run(["flows", "NVDA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [
          /institutional\/quarters/,
          [
            { value: "2026Q1", label: "Q1 2026", reportDate: "2026-03-31", pending: false },
            { value: "2026Q2", label: "Q2 2026", reportDate: "2026-06-30", pending: false },
          ],
        ],
        [
          /institutional\/holders\/NVDA/,
          preview({
            ticker: "NVDA",
            companyName: "NVIDIA Corporation",
            reportDate: "2026-06-30",
            totalInstitutionalShares: 1000,
            totalInstitutionalValue: 182000,
            holderCount: 1,
            holders: [
              {
                filerCik: "0000000001",
                filerName: "Example Advisors",
                filerCategory: "HEDGE_FUND",
                shares: 1000,
                valueUsd: 182000,
                changeType: "INCREASED",
                sharesChange: 100,
                sharesChangePct: 11.1,
              },
            ],
          }),
        ],
      ]),
    });
    expect(result.code).toBe(0);
    expect(url(result, "/institutional/holders/NVDA")).toContain("reportDate=2026-06-30");
    expect(result.stdout).toContain("Example Advisors");
  });

  it("options reads the end-of-day dossier", async () => {
    const result = await run(["options", "NVDA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [
          /stocks\/NVDA\/options\/summary/,
          preview({
            asOf: "2026-08-18",
            sentiment: 0.42,
            latest: { date: "2026-08-18", callVol: 900000, putVol: 700000, pcVol: 0.78, atmIv: 0.412 },
            context: { ivRank1y: 62.1 },
            oiWalls: { expiry: "2026-08-21", maxPain: 175, callWalls: [{ strike: 200, oi: 42100 }] },
            unusual: [
              {
                contract: "NVDA260821C00200000",
                type: "call",
                strike: 200,
                expiry: "2026-08-21",
                dte: 3,
                volume: 15000,
                oi: 89,
                volOiRatio: 168.5,
                premium: 27500000,
              },
            ],
          }),
        ],
      ]),
    });
    expect(result.code).toBe(0);
    expect(url(result, "/api/v1/stocks/NVDA/options/summary")).toBeDefined();
    // The positioning reading is a signed number on the wire, not a label.
    expect(result.stdout).toContain("positioning:  +0.42");
    expect(result.stdout).toContain("NVDA260821C00200000");
  });

  it("options exits 0 when a ticker is outside the covered universe", async () => {
    // An empty result is not a failure, and it matches how an empty window behaves on every
    // other command.
    const envelope = { isPreview: false, previewReason: null, data: null };
    const result = await run(["options", "ZZZZ", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/options\/summary/, envelope]]),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("No options coverage for ZZZZ.\n");

    const asJson = await run(["options", "ZZZZ", "--json"], {
      env: KEYED,
      fetch: routeFetch([[/options\/summary/, envelope]]),
    });
    expect(JSON.parse(asJson.stdout)).toEqual(envelope);
    expect(asJson.code).toBe(0);
  });

  it("screen posts the filter plan it was given", async () => {
    const result = await run(
      [
        "screen",
        "--filter",
        "SENTI_SCORE_7D:GTE:13",
        "--filter",
        "ANALYST_COUNT:GTE:5",
        "--sort",
        "SENTI_SCORE_7D:DESC",
        "--limit",
        "25",
        "--plain",
      ],
      {
        env: KEYED,
        fetch: routeFetch([[/screener\/execute/, { results: [], matched: 0, limit: 25 }]]),
      },
    );
    expect(result.code).toBe(0);
    const body = JSON.parse(String(result.inits[0].body));
    expect(body).toEqual({
      plan: {
        filters: [
          { fieldName: "SENTI_SCORE_7D", op: "GTE", value: 13 },
          { fieldName: "ANALYST_COUNT", op: "GTE", value: 5 },
        ],
        sort: { fieldName: "SENTI_SCORE_7D", dir: "DESC" },
      },
      limit: 25,
    });
  });

  it("screen turns IN into a values list", async () => {
    const result = await run(["screen", "--etf", "--filter", "ISSUER:IN:Vanguard,iShares", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/screener\/etfs\/execute/, { results: [], matched: 0, limit: 100 }]]),
    });
    expect(result.code).toBe(0);
    expect(result.urls[0]).toContain("/api/v1/screener/etfs/execute");
    const body = JSON.parse(String(result.inits[0].body));
    expect(body.plan.filters).toEqual([
      { fieldName: "ISSUER", op: "IN", values: ["Vanguard", "iShares"] },
    ]);
  });

  it("screen refuses a plan with no filters and points at the curated list", async () => {
    const result = await run(["screen"], { env: KEYED });
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("--screen id");
    expect(result.stderr).toContain("--list");
  });

  it("screen rejects an unknown operator", async () => {
    const result = await run(["screen", "--filter", "SENTI_SCORE_7D:ABOVE:13"], { env: KEYED });
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("unknown filter operator");
  });
});

describe("health", () => {
  it("reports a reachable host and a working key", async () => {
    const result = await run(["health", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/market-status/, MARKET_STATUS]]),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("reachable: yes");
    expect(result.stdout).toContain(`cli:       sentisense-cli/${VERSION}`);
    expect(result.stdout).toContain("base url:  https://app.sentisense.ai");
  });

  it("exits 3 and says what to do when no key is configured", async () => {
    const result = await run(["health", "--plain"], {
      env: {},
      fetch: routeFetch([[/market-status/, MARKET_STATUS]]),
    });
    expect(result.code).toBe(3);
    expect(result.stdout).toContain("not configured");
    expect(result.stdout).toContain("https://app.sentisense.ai/get-api-key");
  });

  it("exits 6 when the host cannot be reached", async () => {
    const result = await run(["health", "--plain"], {
      env: KEYED,
      fetch: vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    });
    expect(result.code).toBe(6);
    expect(result.stdout).toContain("unreachable");
  });
});

describe("auth", () => {
  it("stores a key owner-readable and reports it masked", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sentisense-auth-"));
    try {
      const saved = await run(["auth", "ssk_live_abcdefgh1234", "--agent", "desk", "--plain"], {
        env: {},
        configDir: dir,
      });
      expect(saved.code).toBe(0);
      expect(saved.stdout).toContain("ssk_...1234");
      expect(saved.stdout).not.toContain("abcdefgh");
      expect(readConfig(dir)).toEqual({ apiKey: "ssk_live_abcdefgh1234", agentName: "desk" });

      const shown = await run(["auth", "--plain"], { env: {}, configDir: dir });
      expect(shown.stdout).toContain("source:  config");

      const removed = await run(["auth", "--remove", "--plain"], { env: {}, configDir: dir });
      expect(removed.stdout).toContain("Removed");
      expect(readConfig(dir)).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("never calls the API", async () => {
    const fetchMock = routeFetch([]);
    const result = await run(["auth", "--plain"], { env: {}, fetch: fetchMock });
    expect(result.code).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("User-Agent attribution", () => {
  it("stamps the CLI on every request", async () => {
    const result = await run(["quote", "NVDA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [/\/stocks\/NVDA\/quote/, QUOTE_NVDA],
        [/\/stocks\/NVDA\/profile/, PROFILE_NVDA],
      ]),
    });
    const headers = result.inits[0].headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(`sentisense-node/${VERSION} sentisense-cli/${VERSION}`);
  });

  it("adds the agent label when one is configured", async () => {
    const result = await run(["quote", "NVDA", "--agent", "research desk", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [/\/stocks\/NVDA\/quote/, QUOTE_NVDA],
        [/\/stocks\/NVDA\/profile/, PROFILE_NVDA],
      ]),
    });
    const headers = result.inits[0].headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(
      `sentisense-node/${VERSION} sentisense-cli/${VERSION} agent/research-desk`,
    );
  });

  it("reads the agent label from the environment too", async () => {
    const result = await run(["mood", "--plain"], {
      env: { ...KEYED, SENTISENSE_AGENT_NAME: "nightly" },
      fetch: routeFetch([[/market-mood/, MOOD]]),
    });
    const headers = result.inits[0].headers as Record<string, string>;
    expect(headers["User-Agent"]).toContain("agent/nightly");
  });

  it("sends the API key header", async () => {
    const result = await run(["mood", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/market-mood/, MOOD]]),
    });
    const headers = result.inits[0].headers as Record<string, string>;
    expect(headers["X-SentiSense-API-Key"]).toBe("ssk_test");
  });

  it("honours a base URL override", async () => {
    const result = await run(["mood", "--base-url", "https://staging.example.test", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/market-mood/, MOOD]]),
    });
    expect(result.urls[0]).toBe("https://staging.example.test/api/v2/market-mood");
  });
});

describe("help and version", () => {
  it("prints the command map when run bare", async () => {
    const result = await run([], {});
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Usage: sentisense <command>");
    expect(result.stdout).toContain("Research data, not investment advice.");
  });

  it("prints per-command help with examples and exit codes", async () => {
    const result = await run(["help", "quote"], {});
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("sentisense quote NVDA AAPL MSFT");
    expect(result.stdout).toContain("Exit codes:");
    expect(result.stdout).toContain("3  missing or rejected API key");
  });

  it("prints the version", async () => {
    const result = await run(["--version"], {});
    expect(result.stdout).toBe(`${VERSION}\n`);
  });

  it("prints command help for --help without calling the API", async () => {
    const fetchMock = routeFetch([]);
    const result = await run(["quote", "--help"], { env: {}, fetch: fetchMock });
    expect(result.code).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only advertises the disclaimer once, in the main help", async () => {
    const main = await run([], {});
    const perCommand = await run(["help", "mood"], {});
    expect(main.stdout).toContain("Research data, not investment advice.");
    expect(perCommand.stdout).not.toContain("Research data, not investment advice.");
  });
});

describe("flows quarter selection", () => {
  const HOLDERS = preview({
    ticker: "NVDA",
    companyName: "NVIDIA Corporation",
    reportDate: "2026-06-30",
    totalInstitutionalShares: 1000,
    totalInstitutionalValue: 182000,
    holderCount: 1,
    holders: [
      {
        filerCik: "0000000001",
        filerName: "Example Advisors",
        filerCategory: "HEDGE_FUND",
        shares: 1000,
        valueUsd: 182000,
        changeType: "INCREASED",
        sharesChange: 100,
        sharesChangePct: 11.1,
      },
    ],
  });

  it("skips the current quarter while its filing window is still open", async () => {
    // The list leads with the current quarter, and for the 45 days after quarter end it is
    // pending: querying it returns a valid 200 with no holders, which reads exactly like a
    // stock nobody owns.
    const result = await run(["flows", "NVDA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [
          /institutional\/quarters/,
          [
            { value: "2026Q3", label: "Q3 2026", reportDate: "2026-09-30", pending: true },
            { value: "2026Q2", label: "Q2 2026", reportDate: "2026-06-30", pending: false },
            { value: "2026Q1", label: "Q1 2026", reportDate: "2026-03-31", pending: false },
          ],
        ],
        [/institutional\/holders\/NVDA/, HOLDERS],
      ]),
    });
    expect(result.code).toBe(0);
    expect(url(result, "/institutional/holders/NVDA")).toContain("reportDate=2026-06-30");
    expect(url(result, "/institutional/holders/NVDA")).not.toContain("2026-09-30");
  });

  it("falls back to the newest quarter when every one is still pending", async () => {
    const result = await run(["flows", "NVDA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [
          /institutional\/quarters/,
          [
            { value: "2026Q3", label: "Q3 2026", reportDate: "2026-09-30", pending: true },
            { value: "2026Q2", label: "Q2 2026", reportDate: "2026-06-30", pending: true },
          ],
        ],
        [/institutional\/holders\/NVDA/, HOLDERS],
      ]),
    });
    expect(result.code).toBe(0);
    expect(url(result, "/institutional/holders/NVDA")).toContain("reportDate=2026-09-30");
  });

  it("honours an explicit --quarter without asking for the list", async () => {
    const result = await run(["flows", "NVDA", "--quarter", "2026-03-31", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/institutional\/holders\/NVDA/, HOLDERS]]),
    });
    expect(result.code).toBe(0);
    expect(result.urls.some((candidate) => candidate.includes("/quarters"))).toBe(false);
    expect(url(result, "/institutional/holders/NVDA")).toContain("reportDate=2026-03-31");
  });

  it("picks the newest settled quarter whatever order the list arrives in", () => {
    expect(
      latestSettledQuarter([
        { value: "2026Q1", label: "Q1 2026", reportDate: "2026-03-31", pending: false },
        { value: "2026Q3", label: "Q3 2026", reportDate: "2026-09-30", pending: true },
        { value: "2026Q2", label: "Q2 2026", reportDate: "2026-06-30", pending: false },
      ]),
    ).toBe("2026-06-30");
  });

  it("treats a quarter with no pending flag as settled", () => {
    // Older responses predate the flag; absent must not mean pending.
    expect(
      latestSettledQuarter([{ value: "2026Q2", label: "Q2 2026", reportDate: "2026-06-30" }]),
    ).toBe("2026-06-30");
  });

  it("returns nothing for an empty list", () => {
    expect(latestSettledQuarter([])).toBeUndefined();
  });
});

describe("degraded supplementary calls", () => {
  it("still answers, exits 0, and says on stderr that the score history is missing", async () => {
    const result = await run(["sentiment", "NVDA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/\/stocks\/NVDA\/sentiment/, SENTIMENT_NVDA]]),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("score 30d:");
    expect(result.stderr).toBe("note: score history unavailable, showing the reading without it\n");
  });

  it("keeps series null in --json when the history is missing", async () => {
    const result = await run(["sentiment", "NVDA", "--json"], {
      env: KEYED,
      fetch: routeFetch([[/\/stocks\/NVDA\/sentiment/, SENTIMENT_NVDA]]),
    });
    expect(JSON.parse(result.stdout).series).toBeNull();
    expect(result.stderr).toContain("note:");
  });

  it("says nothing when the supplementary call succeeds", async () => {
    const result = await run(["sentiment", "NVDA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [/\/stocks\/NVDA\/sentiment/, SENTIMENT_NVDA],
        [/\/metrics\/entity\/NVDA/, [{ timestamp: 1, value: 55 }]],
      ]),
    });
    expect(result.stderr).toBe("");
  });

  it("notes a missing rating history on analysts", async () => {
    const result = await run(["analysts", "NVDA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [
          /\/analyst\/NVDA\/consensus/,
          preview({
            ticker: "NVDA",
            currentPrice: 182.14,
            targetLow: 150,
            targetMean: 210,
            targetHigh: 260,
            targetMedian: 205,
            numberOfAnalysts: 58,
            upsidePercent: 15.3,
            consensusLabel: "Buy",
            recommendationMean: 1.4,
            strongBuy: 30,
            buy: 20,
            hold: 6,
            sell: 1,
            strongSell: 1,
            updatedAt: "2026-08-18",
          }),
        ],
      ]),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("target mean:");
    expect(result.stderr).toBe("note: rating history unavailable, showing the consensus without it\n");
  });
});
