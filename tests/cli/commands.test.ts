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
  type Route,
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

  it("insiders excludes code-F tax withholding from the sold total", async () => {
    const base = {
      ticker: "NVDA",
      companyName: "NVIDIA Corporation",
      insiderName: "An Officer",
      insiderTitle: "President",
      insiderRelation: "OFFICER",
      officer: true,
      director: false,
      tenPctOwner: false,
      transactionDate: "2026-08-14",
      filedDate: "2026-08-16",
      securityTitle: "Common Stock",
      sharesOwnedAfter: 40000,
      directOwnership: true,
      rule10b51: false,
    };
    const result = await run(["insiders", "NVDA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [
          /insider\/trades\/NVDA/,
          preview([
            {
              ...base,
              transactionCode: "S",
              transactionType: "SELL",
              sharesTransacted: 1000,
              pricePerShare: 100,
              totalValue: 100000,
            },
            {
              ...base,
              transactionCode: "F",
              transactionType: "SELL",
              securityTitle: "Tax Withholding",
              sharesTransacted: 9000,
              pricePerShare: 100,
              totalValue: 900000,
            },
          ]),
        ],
      ]),
    });
    expect(result.code).toBe(0);
    // The sold headline carries only the open-market sale; the code-F dollars
    // land in a separate withheld figure and the row is labeled, not colored.
    expect(result.stdout).toMatch(/sold:\s+100k/);
    expect(result.stdout).toMatch(/withheld:\s+900k/);
    expect(result.stdout).not.toMatch(/sold:\s+1\.0?0?m/i);
    expect(result.stdout).toContain("TAX-W");
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
      fetch: routeFetch([
        [/politicians\/filings\/NVDA/, preview([])],
        [/\/stocks\/NVDA\/quote/, QUOTE_NVDA],
      ]),
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

  // The market-wide feed reads its look-back in hours, so --days has to be converted or the
  // window silently stays at the default.
  it("news turns --days into the hours the market-wide feed reads", async () => {
    const result = await run(["news", "--days", "2", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/documents\/stories\?/, []]]),
    });
    expect(result.code).toBe(0);
    const requested = url(result, "/documents/stories");
    expect(requested).toContain("filterHours=48");
    expect(requested).not.toContain("days=");
  });

  it("news without --days asks for no window at all", async () => {
    const result = await run(["news", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/documents\/stories\?/, []]]),
    });
    expect(result.code).toBe(0);
    const requested = url(result, "/documents/stories");
    expect(requested).toContain("limit=10");
    expect(requested).not.toContain("filterHours=");
    expect(requested).not.toContain("days=");
  });

  it("news on a ticker sends no window, which that feed does not take", async () => {
    const result = await run(["news", "NVDA", "--days", "2", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [/documents\/stories\/ticker\/NVDA/, []],
        [/\/stocks\/NVDA\/quote/, QUOTE_NVDA],
      ]),
    });
    expect(result.code).toBe(0);
    const requested = url(result, "/documents/stories/ticker/NVDA");
    expect(requested).not.toContain("filterHours=");
    expect(requested).not.toContain("days=");
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

  it("options exits 0 when a real ticker is outside the covered universe", async () => {
    // An empty result is not a failure, and it matches how an empty window behaves on every
    // other command. The ticker is verified first so a typo does not land here.
    const envelope = { isPreview: false, previewReason: null, data: null };
    const routes: Route[] = [
      [/options\/summary/, envelope],
      [/\/stocks\/KO\/quote/, { ...QUOTE_NVDA, ticker: "KO" }],
    ];
    const result = await run(["options", "KO", "--plain"], {
      env: KEYED,
      fetch: routeFetch(routes),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("No options coverage for KO.\n");

    const asJson = await run(["options", "KO", "--json"], {
      env: KEYED,
      fetch: routeFetch(routes),
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

  it("never prints any characters of the key, in plain or json output", async () => {
    const key = "ssk_live_abcdefgh1234";
    for (const flag of ["--plain", "--json"]) {
      const result = await run(["health", flag], {
        env: { SENTISENSE_API_KEY: key },
        fetch: routeFetch([[/market-status/, MARKET_STATUS]]),
      });
      expect(result.code).toBe(0);
      for (let i = 0; i + 4 <= key.length; i++) {
        expect(result.stdout).not.toContain(key.slice(i, i + 4));
        expect(result.stderr).not.toContain(key.slice(i, i + 4));
      }
    }
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
      expect(saved.stdout).toContain("hidden (21 chars)");
      expect(saved.stdout).not.toContain("abcdefgh");
      expect(saved.stdout).not.toContain("1234");
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
  it("stamps the CLI on every request, with no comment when nothing was volunteered", async () => {
    const result = await run(["quote", "NVDA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/\/stocks\/NVDA\/quote/, QUOTE_NVDA]]),
    });
    const headers = result.inits[0].headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(`sentisense-node/${VERSION} sentisense-cli/${VERSION}`);
  });

  it("adds the agent label when one is configured", async () => {
    const result = await run(["quote", "NVDA", "--agent", "research desk", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/\/stocks\/NVDA\/quote/, QUOTE_NVDA]]),
    });
    const headers = result.inits[0].headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(
      `sentisense-node/${VERSION} sentisense-cli/${VERSION} (agent/research-desk)`,
    );
  });

  it("adds the skill slug as a bare token in the comment", async () => {
    const result = await run(["quote", "NVDA", "--skill", "stock-analysis", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/\/stocks\/NVDA\/quote/, QUOTE_NVDA]]),
    });
    const headers = result.inits[0].headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(
      `sentisense-node/${VERSION} sentisense-cli/${VERSION} (stock-analysis)`,
    );
  });

  it("carries both identities in one comment, slug first", async () => {
    const result = await run(["mood", "--plain"], {
      env: {
        ...KEYED,
        SENTISENSE_SKILL: "stock-analysis",
        SENTISENSE_AGENT_NAME: "research-desk",
      },
      fetch: routeFetch([[/market-mood/, MOOD]]),
    });
    const headers = result.inits[0].headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(
      `sentisense-node/${VERSION} sentisense-cli/${VERSION} (stock-analysis; agent/research-desk)`,
    );
  });

  it("reads the agent label from the environment too", async () => {
    const result = await run(["mood", "--plain"], {
      env: { ...KEYED, SENTISENSE_AGENT_NAME: "nightly" },
      fetch: routeFetch([[/market-mood/, MOOD]]),
    });
    const headers = result.inits[0].headers as Record<string, string>;
    expect(headers["User-Agent"]).toContain("(agent/nightly)");
  });

  it("cannot be talked into a second comment or an extra product token", async () => {
    const result = await run(["mood", "--plain"], {
      env: {
        ...KEYED,
        SENTISENSE_SKILL: "evil) (x",
        SENTISENSE_AGENT_NAME: "a;b) real-agent/9.9 (",
      },
      fetch: routeFetch([[/market-mood/, MOOD]]),
    });
    const ua = (result.inits[0].headers as Record<string, string>)["User-Agent"];
    expect(ua).toBe(
      `sentisense-node/${VERSION} sentisense-cli/${VERSION} (evil-x; agent/ab-real-agent9.9)`,
    );
    expect(ua.match(/\(/g)).toHaveLength(1);
    expect(ua.match(/\)/g)).toHaveLength(1);
  });

  it("sends the identity through the SDK User-Agent and adds no header of its own", async () => {
    const bare = await run(["mood", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/market-mood/, MOOD]]),
    });
    const identified = await run(["mood", "--plain"], {
      env: { ...KEYED, SENTISENSE_SKILL: "stock-analysis" },
      fetch: routeFetch([[/market-mood/, MOOD]]),
    });

    const before = bare.inits[0].headers as Record<string, string>;
    const after = identified.inits[0].headers as Record<string, string>;
    // Same header set, one header changed: the identity has exactly one way in.
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    expect(after["User-Agent"]).not.toBe(before["User-Agent"]);
    expect(
      Object.entries(after).filter(([key, value]) => before[key] !== value),
    ).toEqual([["User-Agent", after["User-Agent"]]]);
  });

  it("stores both identities and reports them back", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sentisense-identity-"));
    try {
      await run(
        ["auth", "ssk_live_abcdefgh1234", "--agent", "desk", "--skill", "stock-analysis", "--plain"],
        { env: {}, configDir: dir },
      );
      expect(readConfig(dir)).toEqual({
        apiKey: "ssk_live_abcdefgh1234",
        agentName: "desk",
        skill: "stock-analysis",
      });

      const shown = await run(["auth", "--plain"], { env: {}, configDir: dir });
      expect(shown.stdout).toContain("skill:   stock-analysis");

      const used = await run(["mood", "--plain"], {
        env: {},
        configDir: dir,
        fetch: routeFetch([[/market-mood/, MOOD]]),
      });
      const headers = used.inits[0].headers as Record<string, string>;
      expect(headers["User-Agent"]).toContain("(stock-analysis; agent/desk)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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

  it("frames the identity fields as optional in the main help", async () => {
    const result = await run([], {});
    expect(result.stdout).toContain("Saying who is calling (optional):");
    expect(result.stdout).toContain("SENTISENSE_AGENT_NAME");
    expect(result.stdout).toContain("SENTISENSE_SKILL");
    expect(result.stdout).toContain("Nothing needs them");
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

describe("surplus tickers", () => {
  // Silently answering a two-ticker question with one ticker's data is the worst kind of
  // wrong: confident, plausible, and about the wrong company.
  const SINGLE = [
    "sentiment",
    "analysts",
    "earnings",
    "insiders",
    "insights",
    "congress",
    "news",
    "flows",
    "options",
  ];

  for (const name of SINGLE) {
    it(`${name} rejects a second ticker instead of dropping it`, async () => {
      const fetchMock = routeFetch([]);
      const result = await run([name, "NVDA", "AAPL"], { env: KEYED, fetch: fetchMock });
      expect(result.code).toBe(2);
      expect(result.stderr).toContain(`${name} takes one ticker, and got 2`);
      expect(result.stderr).toContain("run it once per ticker");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }

  it("quote still takes as many tickers as it is given", async () => {
    const result = await run(["quote", "NVDA", "AAPL", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [/\/stocks\/NVDA\/quote/, QUOTE_NVDA],
        [/\/stocks\/AAPL\/quote/, { ...QUOTE_NVDA, ticker: "AAPL" }],
      ]),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("NVDA");
    expect(result.stdout).toContain("AAPL");
  });

  it("names the command that has no ticker to take", async () => {
    for (const name of ["mood", "health", "screen"]) {
      const fetchMock = routeFetch([]);
      const result = await run([name, "NVDA"], { env: KEYED, fetch: fetchMock });
      expect(result.code).toBe(2);
      expect(result.stderr).toContain(`${name} takes no ticker`);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });

  it("still reports a missing ticker separately from a surplus one", async () => {
    const result = await run(["sentiment"], { env: KEYED });
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("sentiment needs a ticker");
  });
});

describe("unknown ticker verification on an empty result", () => {
  const EMPTY: Array<[string, string[], Route]> = [
    ["insiders", ["insiders", "TICKER"], [/insider\/trades\/TICKER/, preview([])]],
    ["insights", ["insights", "TICKER"], [/insights\/stock\/TICKER/, preview([])]],
    ["earnings", ["earnings", "TICKER"], [/TICKER\/earnings-summaries/, preview([])]],
    ["congress", ["congress", "TICKER"], [/politicians\/filings\/TICKER/, preview([])]],
    ["news", ["news", "TICKER"], [/documents\/stories\/ticker\/TICKER/, []]],
    [
      "options",
      ["options", "TICKER"],
      [/stocks\/TICKER\/options\/summary/, { isPreview: false, previewReason: null, data: null }],
    ],
  ];

  function withTicker(route: Route, ticker: string): Route {
    return [new RegExp(route[0].source.replace("TICKER", ticker)), route[1]];
  }

  for (const [name, argv, route] of EMPTY) {
    it(`${name} exits 4 when the empty result was a symbol that does not exist`, async () => {
      // The endpoint answers 200 with nothing, exactly as it would for a real company with a
      // quiet window, so only the follow-up lookup can tell the two apart.
      const result = await run(
        argv.map((token) => (token === "TICKER" ? "ZZZZZZ" : token)).concat("--plain"),
        {
          env: KEYED,
          fetch: routeFetch([withTicker(route, "ZZZZZZ")]),
        },
      );
      expect(result.code).toBe(4);
      expect(result.stderr).toContain('unknown ticker "ZZZZZZ"');
      expect(result.stderr).toContain("canonical tickers");
    });

    it(`${name} exits 0 when the empty result was a real but quiet symbol`, async () => {
      const result = await run(
        argv.map((token) => (token === "TICKER" ? "KO" : token)).concat("--plain"),
        {
          env: KEYED,
          fetch: routeFetch([
            withTicker(route, "KO"),
            [/\/stocks\/KO\/quote/, { ...QUOTE_NVDA, ticker: "KO" }],
          ]),
        },
      );
      expect(result.code).toBe(0);
      expect(result.stderr).toBe("");
    });
  }

  it("spends the verification call only on the empty path", async () => {
    const result = await run(["insiders", "NVDA", "--plain"], {
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
    expect(result.urls).toHaveLength(1);
  });

  it("keeps the answer and notes the gap when verification itself fails", async () => {
    // A failed check is not evidence either way, so it must not turn an answered command
    // into a failure.
    const result = await run(["insiders", "KO", "--plain"], {
      env: KEYED,
      fetch: vi.fn(async (input: unknown) => {
        if (String(input).includes("/quote")) throw new TypeError("fetch failed");
        return new Response(JSON.stringify(preview([])), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    });
    expect(result.code).toBe(0);
    expect(result.stderr).toContain("could not verify KO");
  });

  it("does not verify anything on the market-wide feeds", async () => {
    const result = await run(["congress", "--plain"], {
      env: KEYED,
      fetch: routeFetch([[/politicians\/activity/, preview([])]]),
    });
    expect(result.code).toBe(0);
    expect(result.urls.some((candidate) => candidate.includes("/quote"))).toBe(false);
  });
});

describe("examples demonstrate features that actually return data", () => {
  it("earnings shows a ticker that has stored quarters", async () => {
    // Verified live: the per-ticker analysis has no stored quarter for every tracked name,
    // so an example has to name one that does or it demos an empty feature.
    const result = await run(["help", "earnings"], {});
    expect(result.stdout).toContain("sentisense earnings AAPL");
    expect(result.stdout).not.toContain("sentisense earnings NVDA");
  });

  it("insights names a signal type that live data actually carries", async () => {
    const result = await run(["help", "insights"], {});
    expect(result.stdout).toContain("--type institutional_position_change");
    expect(result.stdout).not.toContain("insider_buy_signal");
  });

  it("insights tells the reader where real type names come from", async () => {
    const result = await run(["help", "insights"], {});
    expect(result.stdout).toContain("rather than guessing a name");
  });

  it("commands that verify an empty result say so in their help", async () => {
    for (const name of ["insiders", "insights", "earnings", "congress", "news", "flows", "options"]) {
      const result = await run(["help", name], {});
      expect(result.stdout).toContain("An empty result verifies the ticker before reporting no data");
    }
  });
});
