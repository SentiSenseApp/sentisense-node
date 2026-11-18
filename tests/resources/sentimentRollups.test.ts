import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import SentiSense, {
  type SentimentBreadth,
  type SentimentBreadthBucket,
  type SentimentSectorRow,
  type SentimentSectors,
  type SentimentStockRef,
} from "../../src/index.js";

/**
 * The two market-wide sentiment rollups on the market mood resource. The fixtures are synthetic
 * values in the served shape (same keys and nesting): three days of breadth, two sector rows,
 * fictional tickers.
 *
 * Gated here: the paths and the empty query, every key the wire sends is declared (and every
 * declared key is on the wire), `latest` is typed as the same row as `series` and is the newest
 * entry of it, and the empty shape served before the first snapshot exists.
 */

const mockFetch = vi.fn();
const client = new SentiSense({ apiKey: "ssk_test" });

beforeEach(() => vi.stubGlobal("fetch", mockFetch));
afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

function respond(payload: unknown) {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function requestedUrl(): URL {
  return new URL(String(mockFetch.mock.calls[0][0]));
}

function fixture<T>(name: string): T {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8"),
  ) as T;
}

const BREADTH = fixture<SentimentBreadth>("sentiment_breadth.json");
const SECTORS = fixture<SentimentSectors>("sentiment_sectors.json");

/** Every declared key, checked against the interface by `satisfies`. */
const BREADTH_KEYS = {
  schemaVersion: true,
  generatedAt: true,
  asOf: true,
  minMentions: true,
  latest: true,
  series: true,
} satisfies Record<keyof SentimentBreadth, true>;

const BUCKET_KEYS = {
  date: true,
  coveredStocks: true,
  totalMentions: true,
  bullish: true,
  neutral: true,
  bearish: true,
  bullishPct: true,
  neutralPct: true,
  bearishPct: true,
  netBreadth: true,
  bullishMentionPct: true,
  neutralMentionPct: true,
  bearishMentionPct: true,
  sentimentDispersion: true,
} satisfies Record<keyof SentimentBreadthBucket, true>;

const SECTORS_KEYS = {
  schemaVersion: true,
  generatedAt: true,
  asOf: true,
  narrative: true,
  marketConsensusRatio: true,
  sectors: true,
} satisfies Record<keyof SentimentSectors, true>;

const SECTOR_ROW_KEYS = {
  sector: true,
  meanSentiment: true,
  label: true,
  meanScore: true,
  scoreLabel: true,
  consensusRatio: true,
  consensusVsMarket: true,
  consensusLabel: true,
  bullMentions: true,
  bearMentions: true,
  stockCount: true,
  totalMentions: true,
  topStock: true,
  bottomStock: true,
} satisfies Record<keyof SentimentSectorRow, true>;

const STOCK_REF_KEYS = { ticker: true, value: true } satisfies Record<keyof SentimentStockRef, true>;

function sortedKeys(o: object): string[] {
  return Object.keys(o).sort();
}

describe("marketMood.getSentimentBreadth", () => {
  it("calls the breadth path with no query", async () => {
    respond(BREADTH);
    await client.marketMood.getSentimentBreadth();
    const url = requestedUrl();
    expect(url.pathname).toBe("/api/v1/sentiment/breadth");
    expect(url.search).toBe("");
  });

  it("returns the payload untouched", async () => {
    respond(BREADTH);
    await expect(client.marketMood.getSentimentBreadth()).resolves.toEqual(BREADTH);
  });

  it("types latest as the same row as series, and it is the newest entry of series", async () => {
    respond(BREADTH);
    const breadth = await client.marketMood.getSentimentBreadth();
    expectTypeOf(breadth.latest).toEqualTypeOf<SentimentBreadthBucket | undefined>();
    expectTypeOf(breadth.series).toEqualTypeOf<SentimentBreadthBucket[]>();
    expectTypeOf(breadth.generatedAt).toEqualTypeOf<number | undefined>();

    const dates = breadth.series.map((b) => b.date ?? "");
    expect(dates).toEqual([...dates].sort());
    expect(breadth.latest).toEqual(breadth.series[breadth.series.length - 1]);
    expect(breadth.latest?.date).toBe(breadth.asOf);
  });

  it("declares every key the wire sends, and the wire sends every declared key", () => {
    expect(sortedKeys(BREADTH)).toEqual(sortedKeys(BREADTH_KEYS));
    for (const bucket of [BREADTH.latest!, ...BREADTH.series]) {
      expect(sortedKeys(bucket)).toEqual(sortedKeys(BUCKET_KEYS));
    }
  });

  it("keeps the documented arithmetic on the buckets", () => {
    for (const b of BREADTH.series) {
      expect(b.bullish! + b.neutral! + b.bearish!).toBe(b.coveredStocks);
      expect(b.netBreadth).toBeCloseTo(b.bullishPct! - b.bearishPct!, 1);
      expect(b.bullishPct! + b.neutralPct! + b.bearishPct!).toBeCloseTo(100, 0);
      expect(b.bullishMentionPct! + b.neutralMentionPct! + b.bearishMentionPct!).toBeCloseTo(100, 0);
    }
  });

  it("reads the empty shape served before the first snapshot", async () => {
    respond({ series: [] });
    const breadth = await client.marketMood.getSentimentBreadth();
    expect(breadth.latest).toBeUndefined();
    expect(breadth.generatedAt).toBeUndefined();
    expect(breadth.series).toEqual([]);
  });

  it("leaves an omitted dispersion undefined, never zero", async () => {
    const { sentimentDispersion: _omitted, ...thin } = BREADTH.latest!;
    respond({ ...BREADTH, latest: thin, series: [thin] });
    const breadth = await client.marketMood.getSentimentBreadth();
    expect(breadth.latest?.sentimentDispersion).toBeUndefined();
    expect(breadth.series[0].coveredStocks).toBe(BREADTH.latest!.coveredStocks);
  });
});

describe("marketMood.getSentimentSectors", () => {
  it("calls the sectors path with no query", async () => {
    respond(SECTORS);
    await client.marketMood.getSentimentSectors();
    const url = requestedUrl();
    expect(url.pathname).toBe("/api/v1/sentiment/sectors");
    expect(url.search).toBe("");
  });

  it("returns typed sector rows with their stock references", async () => {
    respond(SECTORS);
    const result = await client.marketMood.getSentimentSectors();
    expect(result).toEqual(SECTORS);
    expectTypeOf(result.sectors).toEqualTypeOf<SentimentSectorRow[]>();
    expectTypeOf(result.sectors[0].topStock).toEqualTypeOf<SentimentStockRef | undefined>();

    const [energy] = result.sectors;
    expect(energy.sector).toBe("Energy");
    expect(energy.label).toBe("Bullish");
    expect(energy.consensusLabel).toBe("Hotter than market");
    expect(energy.topStock?.ticker).toBe("EXMP");
    expect(energy.bottomStock?.value).toBeLessThan(0);
  });

  it("measures each row's consensusVsMarket against the snapshot's market ratio", () => {
    for (const row of SECTORS.sectors) {
      expect(row.consensusVsMarket).toBeCloseTo(row.consensusRatio! - SECTORS.marketConsensusRatio!, 3);
    }
  });

  it("declares every key the wire sends, and the wire sends every declared key", () => {
    expect(sortedKeys(SECTORS)).toEqual(sortedKeys(SECTORS_KEYS));
    for (const row of SECTORS.sectors) {
      expect(sortedKeys(row)).toEqual(sortedKeys(SECTOR_ROW_KEYS));
      expect(sortedKeys(row.topStock!)).toEqual(sortedKeys(STOCK_REF_KEYS));
      expect(sortedKeys(row.bottomStock!)).toEqual(sortedKeys(STOCK_REF_KEYS));
    }
  });

  it("reads the empty shape served before the first snapshot", async () => {
    respond({ sectors: [] });
    const result = await client.marketMood.getSentimentSectors();
    expect(result.sectors).toEqual([]);
    expect(result.narrative).toBeUndefined();
  });

  it("leaves omitted score fields undefined, never zero", async () => {
    const { meanScore: _s, scoreLabel: _l, ...row } = SECTORS.sectors[0];
    respond({ ...SECTORS, sectors: [row] });
    const result = await client.marketMood.getSentimentSectors();
    expect(result.sectors[0].meanScore).toBeUndefined();
    expect(result.sectors[0].scoreLabel).toBeUndefined();
    expect(result.sectors[0].meanSentiment).toBe(SECTORS.sectors[0].meanSentiment);
  });
});
