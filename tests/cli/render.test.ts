import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MOOD,
  PROFILE_NVDA,
  QUOTE_NVDA,
  SENTIMENT_NVDA,
  routeFetch,
  run,
} from "./harness.js";
import { percent, ratioPercent, sparkline } from "../../src/cli/render/num.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const ESC = "\u001b";
const KEYED = { SENTISENSE_API_KEY: "ssk_test" };

const sentimentRoutes = () =>
  routeFetch([
    [/\/api\/v1\/stocks\/NVDA\/sentiment/, SENTIMENT_NVDA],
    [
      /\/api\/v2\/metrics\/entity\/NVDA/,
      [40, 41, 45, 44, 52, 58, 55, 63, 68, 71].map((value, index) => ({
        timestamp: 1787169600000 - (9 - index) * 86400000,
        value,
      })),
    ],
  ]);

const moodRoutes = () => routeFetch([[/\/api\/v2\/market-mood/, MOOD]]);

describe("quote rendering", () => {
  it("prints aligned plain text with no escape codes", async () => {
    const result = await run(["quote", "NVDA", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [/\/api\/v1\/stocks\/NVDA\/quote/, QUOTE_NVDA],
        [/\/api\/v1\/stocks\/NVDA\/profile/, PROFILE_NVDA],
      ]),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain(ESC);
    expect(result.stdout).toMatchInlineSnapshot(`
      "ticker: NVDA
      price:  $182.14
      change: +1.83 (+1.02%)
      Open:       180.30
      High:       183.02
      Low:        179.88
      Volume:     4.2M
      Prev close: 180.31
      Mkt cap:   4.44T
      P/E:       58.20
      EPS TTM:   3.13
      Div yield: 0.13%
      52w:       86.62 to 184.48
      price as of 2026-08-19 20:00 UTC
      "
    `);
  });

  it("prints the terminal layout when told to, without colour off a terminal", async () => {
    const result = await run(["quote", "NVDA", "--pretty"], {
      env: KEYED,
      fetch: routeFetch([
        [/\/api\/v1\/stocks\/NVDA\/quote/, QUOTE_NVDA],
        [/\/api\/v1\/stocks\/NVDA\/profile/, PROFILE_NVDA],
      ]),
    });
    expect(result.stdout).not.toContain(ESC);
    expect(result.stdout).toMatchInlineSnapshot(`
      "NVDA  NVIDIA Corporation                               $182.14  +1.83 (+1.02%)
      Open 180.30   High 183.02   Low 179.88   Volume 4.2M   Prev close 180.31
      Mkt cap 4.44T   P/E 58.20   EPS TTM 3.13   Div yield 0.13%   52w 86.62 to 184.48
      price as of 2026-08-19 20:00 UTC
      "
    `);
  });

  it("colours the change green on a terminal", async () => {
    const result = await run(["quote", "NVDA"], {
      env: KEYED,
      isTTY: true,
      fetch: routeFetch([
        [/\/api\/v1\/stocks\/NVDA\/quote/, QUOTE_NVDA],
        [/\/api\/v1\/stocks\/NVDA\/profile/, PROFILE_NVDA],
      ]),
    });
    expect(result.stdout).toContain(`${ESC}[32m+1.83 (+1.02%)${ESC}[0m`);
    expect(result.stdout).toContain(`${ESC}[1mNVDA${ESC}[0m`);
  });

  it("drops colour when NO_COLOR is set, terminal or not", async () => {
    const result = await run(["quote", "NVDA"], {
      env: { ...KEYED, NO_COLOR: "1" },
      isTTY: true,
      fetch: routeFetch([
        [/\/api\/v1\/stocks\/NVDA\/quote/, QUOTE_NVDA],
        [/\/api\/v1\/stocks\/NVDA\/profile/, PROFILE_NVDA],
      ]),
    });
    expect(result.stdout).not.toContain(ESC);
  });

  it("drops colour for --no-color", async () => {
    const result = await run(["quote", "NVDA", "--no-color"], {
      env: KEYED,
      isTTY: true,
      fetch: routeFetch([
        [/\/api\/v1\/stocks\/NVDA\/quote/, QUOTE_NVDA],
        [/\/api\/v1\/stocks\/NVDA\/profile/, PROFILE_NVDA],
      ]),
    });
    expect(result.stdout).not.toContain(ESC);
  });

  it("prints the exact quote response under --json for one ticker", async () => {
    const result = await run(["quote", "NVDA", "--json"], {
      env: KEYED,
      fetch: routeFetch([
        [/\/api\/v1\/stocks\/NVDA\/quote/, QUOTE_NVDA],
        [/\/api\/v1\/stocks\/NVDA\/profile/, PROFILE_NVDA],
      ]),
    });
    expect(JSON.parse(result.stdout)).toEqual(QUOTE_NVDA);
    expect(result.stdout.split("\n")[1]).toBe('  "ticker": "NVDA",');
  });

  it("keys --json by ticker for more than one, with the quote responses untouched", async () => {
    const result = await run(["quote", "NVDA", "AAPL", "--json"], {
      env: KEYED,
      fetch: routeFetch([
        [/\/api\/v1\/stocks\/NVDA\/quote/, QUOTE_NVDA],
        [/\/api\/v1\/stocks\/AAPL\/quote/, { ...QUOTE_NVDA, ticker: "AAPL" }],
      ]),
    });
    expect(JSON.parse(result.stdout)).toEqual({
      NVDA: QUOTE_NVDA,
      AAPL: { ...QUOTE_NVDA, ticker: "AAPL" },
    });
  });

  it("switches to a table for more than one ticker", async () => {
    const result = await run(["quote", "NVDA", "AAPL", "--plain"], {
      env: KEYED,
      fetch: routeFetch([
        [/\/api\/v1\/stocks\/NVDA\/quote/, QUOTE_NVDA],
        [/\/api\/v1\/stocks\/NVDA\/profile/, PROFILE_NVDA],
        [/\/api\/v1\/stocks\/AAPL\/quote/, { ...QUOTE_NVDA, ticker: "AAPL", currentPrice: 231.5, change: -2.1, changePercent: -0.9 }],
        [/\/api\/v1\/stocks\/AAPL\/profile/, { ticker: "AAPL", name: "Apple Inc" }],
      ]),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toMatchInlineSnapshot(`
      "TICKER   PRICE  CHANGE  CHANGE%  VOLUME  MKT CAP
      NVDA    182.14   +1.83   +1.02%    4.2M    4.44T
      AAPL    231.50   -2.10   -0.90%    4.2M    4.44T
      "
    `);
  });
});

describe("sentiment rendering", () => {
  it("prints plain text", async () => {
    const result = await run(["sentiment", "NVDA", "--plain"], {
      env: KEYED,
      fetch: sentimentRoutes(),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toMatchInlineSnapshot(`
      "ticker:    NVDA
      name:      NVIDIA Corporation
      score 30d: 63.2
      band:      Strong
      direction: Bullish
      Latest:     71.4
      30d change: +8.2
      Trend:      UP
      Mentions:  4.2k
      30d avg:   3.8k
      Dominance: 8.30%
      30d: ▁▁▂▂▄▅▄▆▇█
      30d note: as of 2026-08-19

      SOURCE  TONE     SHARE  VALUE
      News    Bullish    52%  +0.44
      Reddit  Neutral    31%  +0.08
      X       Bullish    18%  +0.61
      Shares are rounded per source, so they sum to about 100 rather than exactly 100.
      "
    `);
  });

  it("prints the terminal layout", async () => {
    const result = await run(["sentiment", "NVDA", "--pretty"], {
      env: KEYED,
      fetch: sentimentRoutes(),
    });
    expect(result.stdout).toMatchInlineSnapshot(`
      "NVDA  NVIDIA Corporation                                 63.2  Strong  Bullish
      Latest 71.4   30d change +8.2   Trend UP
      Mentions 4.2k   30d avg 3.8k   Dominance 8.30%
      30d ▁▁▂▂▄▅▄▆▇█   as of 2026-08-19

      SOURCE  TONE     SHARE  VALUE
      News    Bullish    52%  +0.44
      Reddit  Neutral    31%  +0.08
      X       Bullish    18%  +0.61
      Shares are rounded per source, so they sum to about 100 rather than exactly 100.
      "
    `);
  });

  it("labels the window with --days and asks the metrics endpoint for it", async () => {
    const result = await run(["sentiment", "NVDA", "--days", "7", "--plain"], {
      env: KEYED,
      fetch: sentimentRoutes(),
    });
    expect(result.stdout).toContain("7d:");
    expect(result.urls.some((url) => url.includes("maxDataPoints=7"))).toBe(true);
  });

  it("keeps the preview envelope in --json", async () => {
    const result = await run(["sentiment", "NVDA", "--json"], {
      env: KEYED,
      fetch: sentimentRoutes(),
    });
    const parsed = JSON.parse(result.stdout);
    expect(parsed.sentiment).toEqual(SENTIMENT_NVDA);
    expect(parsed.sentiment.isPreview).toBe(false);
    expect(parsed.series).toHaveLength(10);
  });
});

describe("mood rendering", () => {
  it("prints plain text", async () => {
    const result = await run(["mood", "--plain"], { env: KEYED, fetch: moodRoutes() });
    expect(result.code).toBe(0);
    expect(result.stdout).toMatchInlineSnapshot(`
      "index:         Market Mood
      score:         62.9
      phase:         Optimism
      weekly change: -2.3 wk
      Social Sentiment: 55.0
      Market Direction: 71.0
      Risk Appetite:    58.4
      3d: ▁█▅
      3d note: to 2026-08-19

      SECTOR      SCORE  PHASE    WEEK
      Technology   71.2  Greed    +1.5
      Healthcare   48.3  Neutral  -3.1
      "
    `);
  });

  it("prints the terminal layout", async () => {
    const result = await run(["mood", "--pretty"], { env: KEYED, fetch: moodRoutes() });
    expect(result.stdout).toMatchInlineSnapshot(`
      "Market Mood                                            62.9  Optimism  -2.3 wk
      Social Sentiment 55.0   Market Direction 71.0   Risk Appetite 58.4
      3d ▁█▅   to 2026-08-19

      SECTOR      SCORE  PHASE    WEEK
      Technology   71.2  Greed    +1.5
      Healthcare   48.3  Neutral  -3.1
      "
    `);
  });

  it("colours a falling week red", async () => {
    const result = await run(["mood"], { env: KEYED, isTTY: true, fetch: moodRoutes() });
    expect(result.stdout).toContain(`${ESC}[31m-2.3 wk${ESC}[0m`);
  });

  it("passes the payload through untouched under --json", async () => {
    const result = await run(["mood", "--json"], { env: KEYED, fetch: moodRoutes() });
    expect(JSON.parse(result.stdout)).toEqual(MOOD);
  });
});

describe("sparkline", () => {
  it("maps a rising series across the full range", () => {
    expect(sparkline([1, 2, 3, 4, 5, 6, 7, 8])).toBe("▁▂▃▄▅▆▇█");
  });

  it("sits a flat series on the middle level rather than the floor", () => {
    expect(sparkline([5, 5, 5])).toBe("▄▄▄");
  });

  it("keeps a gap as a gap so the line stays the length of the series", () => {
    expect(sparkline([1, null, 8])).toBe("▁ █");
  });

  it("renders nothing for an empty series", () => {
    expect(sparkline([])).toBe("");
  });
});

describe("ratioPercent", () => {
  it("scales a fraction to percentage points exactly once", () => {
    expect(ratioPercent(0.031)).toBe("3.10%");
  });

  it("keeps a small yield visible instead of rounding it to zero", () => {
    expect(ratioPercent(0.001287)).toBe("0.13%");
  });

  it("prints a plain zero only for a true zero", () => {
    expect(ratioPercent(0)).toBe("0.00%");
  });

  it("widens the decimals rather than let a real value read as zero", () => {
    expect(ratioPercent(0.00001)).toBe("0.001%");
  });

  it("keeps the sign on a negative ratio", () => {
    expect(ratioPercent(-0.031)).toBe("-3.10%");
  });

  it("reports an absent value as absent rather than as zero", () => {
    expect(ratioPercent(null)).toBe("n/a");
    expect(ratioPercent(undefined)).toBe("n/a");
    expect(ratioPercent(Number.NaN)).toBe("n/a");
  });
});

describe("percent", () => {
  it("leaves a value that is already percentage points alone", () => {
    expect(percent(3.1, 2)).toBe("3.10%");
    expect(percent(34.49, 2)).toBe("34.49%");
  });
});
