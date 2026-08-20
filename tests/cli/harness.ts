import { vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli, type CliIO } from "../../src/cli/run.js";

/**
 * Drives the whole CLI in-process.
 *
 * No spawning and no real network: `runCli` takes its streams, environment, and config
 * directory as arguments, so a test can assert on the exact bytes a command prints and the
 * exact code it exits with.
 */

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(
  status: number,
  body: { error?: string; message?: string } = {},
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export type Route = [RegExp, unknown];

/** Answers by URL rather than by call order, so a test does not encode request sequencing. */
export function routeFetch(routes: Route[]) {
  return vi.fn(async (input: unknown) => {
    const url = String(input);
    for (const [pattern, payload] of routes) {
      if (pattern.test(url)) {
        return payload instanceof Response ? payload.clone() : jsonResponse(payload);
      }
    }
    return errorResponse(404, { error: "not_found", message: `no route for ${url}` });
  });
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
  /** Every URL the run requested, in order. */
  urls: string[];
  /** Every request init the run sent, in order. */
  inits: Array<Record<string, unknown>>;
}

export interface RunOptions {
  env?: Record<string, string | undefined>;
  isTTY?: boolean;
  configDir?: string;
  fetch?: ReturnType<typeof vi.fn>;
}

export async function run(argv: string[], options: RunOptions = {}): Promise<RunResult> {
  const disposable = options.configDir === undefined;
  const configDir = options.configDir ?? mkdtempSync(join(tmpdir(), "sentisense-run-"));
  const mock = options.fetch ?? routeFetch([]);
  vi.stubGlobal("fetch", mock);

  let stdout = "";
  let stderr = "";
  const io: CliIO = {
    stdout: (chunk) => {
      stdout += chunk;
    },
    stderr: (chunk) => {
      stderr += chunk;
    },
    env: options.env ?? {},
    configDir,
    isTTY: options.isTTY,
  };

  try {
    const code = await runCli(argv, io);
    return {
      code,
      stdout,
      stderr,
      urls: mock.mock.calls.map((call) => String(call[0])),
      inits: mock.mock.calls.map((call) => (call[1] ?? {}) as Record<string, unknown>),
    };
  } finally {
    if (disposable) rmSync(configDir, { recursive: true, force: true });
  }
}

// ── Fixtures ────────────────────────────────────────────────
//
// Fixed values with fixed timestamps, so a renderer snapshot is a statement about layout
// rather than about the day it ran.

export const QUOTE_NVDA = {
  ticker: "NVDA",
  currentPrice: 182.14,
  change: 1.83,
  changePercent: 1.0155,
  volume: 4210000,
  open: 180.3,
  dayHigh: 183.02,
  dayLow: 179.88,
  previousClose: 180.31,
  week52High: 184.48,
  week52Low: 86.62,
  marketCap: 4440000000000,
  peRatio: 58.2,
  epsTTM: 3.13,
  dividendYield: 0.03,
  movingAverage200Day: 152.4,
  timestamp: 1787169600000,
  priceAsOf: 1787169600000,
};

export const PROFILE_NVDA = {
  ticker: "NVDA",
  name: "NVIDIA Corporation",
  sector: "Technology",
  industry: "Semiconductors",
  ceo: "Jensen Huang",
};

export const SENTIMENT_NVDA = {
  isPreview: false,
  previewReason: null,
  data: {
    ticker: "NVDA",
    companyName: "NVIDIA Corporation",
    asOf: "2026-08-19",
    sentisenseScore: 71.4,
    sentisenseScoreAvg30d: 63.2,
    sentisenseScoreDelta30d: 8.2,
    scoreLabel: "Strong",
    direction: "Bullish",
    latestDirection: "Bullish",
    trend: "UP",
    scoreSparkline: [40, 44, 48, 52, 61, 66, 71],
    mentions: 4210,
    mentionsAvg30d: 3800,
    socialDominance: 0.083,
    bySource: [
      { source: "News", direction: "Bullish", mentionShare: 52, value: 0.44 },
      { source: "Reddit", direction: "Neutral", mentionShare: 31, value: 0.08 },
      { source: "X", direction: "Bullish", mentionShare: 18, value: 0.61 },
    ],
    drivers: [{ title: "Record data centre revenue", tone: 0.72 }],
  },
};

export const MOOD = {
  market: {
    currentScore: 62.88,
    phase: "Optimism",
    weeklyChange: -2.3,
    signals: [
      { key: "social_sentiment", label: "Social Sentiment", value: 54.95, change: -1.2 },
      { key: "market_direction", label: "Market Direction", value: 71, change: 3.1 },
      { key: "fear_gauge", label: "Risk Appetite", value: 58.4, change: null },
    ],
    history: [
      { date: "2026-08-17", score: 61.1 },
      { date: "2026-08-18", score: 64 },
      { date: "2026-08-19", score: 62.88 },
    ],
  },
  sectors: {
    Technology: { currentScore: 71.2, phase: "Greed", weeklyChange: 1.5 },
    Healthcare: { currentScore: 48.3, phase: "Neutral", weeklyChange: -3.1 },
  },
};

export const MARKET_STATUS = { status: "open" };
