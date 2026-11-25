import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import SentiSense, {
  SentiSenseError,
  type EventCategory,
  type EventCounts,
  type EventCountsDay,
  type HeadlineScore,
  type HeadlineScoreCounts,
  type HeadlineScoreLevel,
  type HeadlineScores,
  type HeadlineScoresDay,
  type NewsSignalsOptions,
  type PreviewResponse,
} from "../../src/index.js";

/**
 * News event counts and headline scores. The fixtures are full responses in the API's shape with
 * synthetic values.
 */

const mockFetch = vi.fn();
const client = new SentiSense({ apiKey: "ssk_test", maxRetries: 0 });

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

function requestedUrl(call = 0): URL {
  return new URL(String(mockFetch.mock.calls[call][0]));
}

function fixture<T>(name: string): T {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8"),
  ) as T;
}

const EVENT_COUNTS = fixture<PreviewResponse<EventCounts>>("event_counts.json");
const HEADLINE_SCORES = fixture<PreviewResponse<HeadlineScores>>("headline_scores.json");
const MARKET_EVENT_COUNTS = fixture<PreviewResponse<EventCounts>>("market_event_counts.json");
const MARKET_HEADLINE_SCORES = fixture<PreviewResponse<HeadlineScores>>("market_headline_scores.json");

function preview<T>(full: PreviewResponse<T>): PreviewResponse<T> {
  return {
    ...structuredClone(full),
    isPreview: true,
    previewReason: "PRO_REQUIRED",
    upgrade: { url: "https://app.sentisense.ai/pricing" } as PreviewResponse<T>["upgrade"],
  };
}

/** Every declared key, checked against each interface by `satisfies`. */
const KEYS = {
  EventCounts: {
    entity: true,
    from: true,
    to: true,
    asOf: true,
    timezone: true,
    coverageStart: true,
    categories: true,
    days: true,
  } satisfies Record<keyof EventCounts, true>,
  EventCategory: { key: true, name: true, eventTypes: true } satisfies Record<keyof EventCategory, true>,
  EventCountsDay: {
    date: true,
    headlines: true,
    classified: true,
    noEvent: true,
    withEvent: true,
    categories: true,
  } satisfies Record<keyof EventCountsDay, true>,
  HeadlineScores: {
    entity: true,
    from: true,
    to: true,
    asOf: true,
    timezone: true,
    coverageStart: true,
    scores: true,
    days: true,
  } satisfies Record<keyof HeadlineScores, true>,
  HeadlineScore: {
    key: true,
    name: true,
    strongFrom: true,
    strongLabel: true,
    levels: true,
  } satisfies Record<keyof HeadlineScore, true>,
  HeadlineScoreLevel: { name: true, from: true, to: true, strong: true } satisfies Record<
    keyof HeadlineScoreLevel,
    true
  >,
  HeadlineScoresDay: {
    date: true,
    headlines: true,
    rated: true,
    strongHeadlines: true,
    scores: true,
  } satisfies Record<keyof HeadlineScoresDay, true>,
  HeadlineScoreCounts: { rated: true, strong: true, levels: true } satisfies Record<
    keyof HeadlineScoreCounts,
    true
  >,
};

function keysOf(o: object): string[] {
  return Object.keys(o).sort();
}

function declared(name: keyof typeof KEYS): string[] {
  return Object.keys(KEYS[name]).sort();
}

describe("newsSignals: requests", () => {
  it("lives on newsSignals only, not on entityMetrics", () => {
    for (const name of [
      "getEventCounts",
      "getMarketEventCounts",
      "getHeadlineScores",
      "getMarketHeadlineScores",
    ]) {
      expect(typeof (client.newsSignals as unknown as Record<string, unknown>)[name]).toBe("function");
      expect((client.entityMetrics as unknown as Record<string, unknown>)[name]).toBeUndefined();
    }
  });

  it("getEventCounts calls the entity route with no query by default", async () => {
    respond(EVENT_COUNTS);
    await client.newsSignals.getEventCounts("AAPL");
    const url = requestedUrl();
    expect(url.pathname).toBe("/api/v2/metrics/entity/AAPL/event-counts");
    expect(url.search).toBe("");
  });

  it("getHeadlineScores calls the entity route and sends days", async () => {
    respond(HEADLINE_SCORES);
    await client.newsSignals.getHeadlineScores("Example-Entity", { days: 7 });
    const url = requestedUrl();
    expect(url.pathname).toBe("/api/v2/metrics/entity/Example-Entity/headline-scores");
    expect(url.searchParams.get("days")).toBe("7");
    expect([...url.searchParams.keys()]).toEqual(["days"]);
  });

  it("the market methods call the market routes and send from and to", async () => {
    respond(MARKET_EVENT_COUNTS);
    await client.newsSignals.getMarketEventCounts({ from: "2026-11-01", to: "2026-11-22" });
    respond(MARKET_HEADLINE_SCORES);
    await client.newsSignals.getMarketHeadlineScores();
    const first = requestedUrl(0);
    expect(first.pathname).toBe("/api/v2/metrics/market/event-counts");
    expect(first.searchParams.get("from")).toBe("2026-11-01");
    expect(first.searchParams.get("to")).toBe("2026-11-22");
    expect([...first.searchParams.keys()].sort()).toEqual(["from", "to"]);
    const second = requestedUrl(1);
    expect(second.pathname).toBe("/api/v2/metrics/market/headline-scores");
    expect(second.search).toBe("");
  });

  it("keeps an entity with reserved characters in one path segment", async () => {
    respond(EVENT_COUNTS);
    await client.newsSignals.getEventCounts("A/B?C");
    expect(requestedUrl().pathname).toBe("/api/v2/metrics/entity/A%2FB%3FC/event-counts");
  });

  it.each(["", "   ", ".", ".."])("refuses the entity %j before any request", async (bad) => {
    await expect(client.newsSignals.getEventCounts(bad)).rejects.toBeInstanceOf(SentiSenseError);
    await expect(client.newsSignals.getHeadlineScores(bad)).rejects.toBeInstanceOf(SentiSenseError);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("newsSignals: responses", () => {
  it("returns the full envelope as sent", async () => {
    respond(EVENT_COUNTS);
    const result = await client.newsSignals.getEventCounts("AAPL");
    expectTypeOf(result).toEqualTypeOf<PreviewResponse<EventCounts>>();
    expect(result).toEqual(EVENT_COUNTS);
    expect(result.isPreview).toBe(false);
    expect(result.data.from <= result.data.to).toBe(true);
  });

  it("returns a free preview in the same data shape", async () => {
    respond(preview(MARKET_HEADLINE_SCORES));
    const result = await client.newsSignals.getMarketHeadlineScores();
    expectTypeOf(result).toEqualTypeOf<PreviewResponse<HeadlineScores>>();
    expect(result.isPreview).toBe(true);
    expect(result.previewReason).toBe("PRO_REQUIRED");
    expect(result.data).toEqual(MARKET_HEADLINE_SCORES.data);
    expect(result.data.entity).toBe("market");
  });

  it("days are oldest first and asOf is the newest", () => {
    for (const body of [EVENT_COUNTS, HEADLINE_SCORES, MARKET_EVENT_COUNTS, MARKET_HEADLINE_SCORES]) {
      const dates = body.data.days.map((d) => d.date);
      expect(dates).toEqual([...dates].sort());
      expect(body.data.asOf).toBe(dates[dates.length - 1]);
      expect(body.data.timezone).toBe("America/New_York");
    }
  });
});

describe("newsSignals: declared keys match the wire", () => {
  it.each([EVENT_COUNTS, MARKET_EVENT_COUNTS])("event counts", (body) => {
    expect(keysOf(body.data)).toEqual(declared("EventCounts"));
    for (const c of body.data.categories) expect(keysOf(c)).toEqual(declared("EventCategory"));
    for (const d of body.data.days) expect(keysOf(d)).toEqual(declared("EventCountsDay"));
  });

  it.each([HEADLINE_SCORES, MARKET_HEADLINE_SCORES])("headline scores", (body) => {
    expect(keysOf(body.data)).toEqual(declared("HeadlineScores"));
    for (const s of body.data.scores) {
      expect(keysOf(s)).toEqual(declared("HeadlineScore"));
      for (const l of s.levels) expect(keysOf(l)).toEqual(declared("HeadlineScoreLevel"));
    }
    for (const d of body.data.days) {
      expect(keysOf(d)).toEqual(declared("HeadlineScoresDay"));
      for (const c of Object.values(d.scores)) expect(keysOf(c)).toEqual(declared("HeadlineScoreCounts"));
    }
  });
});

describe("newsSignals: day identities", () => {
  it.each([EVENT_COUNTS, MARKET_EVENT_COUNTS])("event counts add up", (body) => {
    const keys = body.data.categories.map((c) => c.key);
    expect(keys).toEqual(["RESULTS", "PRODUCT", "ANALYST", "DEALS", "LEGAL", "PEOPLE", "MACRO"]);
    for (const day of body.data.days) {
      expect(Object.keys(day.categories)).toEqual(keys);
      expect(day.withEvent).toBe(day.classified - day.noEvent);
      expect(day.withEvent).toBe(Object.values(day.categories).reduce((a, b) => a + b, 0));
      expect(day.classified).toBeLessThanOrEqual(day.headlines);
    }
  });

  it.each([HEADLINE_SCORES, MARKET_HEADLINE_SCORES])("headline scores add up", (body) => {
    const scores = new Map(body.data.scores.map((s) => [s.key, s]));
    expect([...scores.keys()]).toEqual(["UNCERTAINTY", "PROMOTION", "RESOLUTION"]);
    for (const day of body.data.days) {
      expect(day.strongHeadlines).toBeLessThanOrEqual(day.rated);
      expect(day.rated).toBeLessThanOrEqual(day.headlines);
      for (const [key, counts] of Object.entries(day.scores)) {
        const levels = scores.get(key)!.levels;
        expect(counts.levels).toHaveLength(levels.length);
        const strong = counts.levels.reduce((sum, n, i) => sum + (levels[i].strong ? n : 0), 0);
        expect(counts.strong).toBe(strong);
        expect(counts.rated).toBeLessThanOrEqual(day.rated);
      }
    }
  });
});

describe("NewsSignalsOptions", () => {
  it("accepts no options, days alone, or from and to together", () => {
    const none: NewsSignalsOptions = {};
    const days: NewsSignalsOptions = { days: 7 };
    const range: NewsSignalsOptions = { from: "2026-11-01", to: "2026-11-07" };
    expect([none, days, range]).toHaveLength(3);
  });

  it("refuses days with from or to, and from without to", () => {
    // @ts-expect-error days cannot be combined with from and to
    const mixed: NewsSignalsOptions = { days: 7, from: "2026-11-01", to: "2026-11-07" };
    // @ts-expect-error days cannot be combined with from
    const daysAndFrom: NewsSignalsOptions = { days: 7, from: "2026-11-01" };
    // @ts-expect-error from needs to
    const fromOnly: NewsSignalsOptions = { from: "2026-11-01" };
    // @ts-expect-error to needs from
    const toOnly: NewsSignalsOptions = { to: "2026-11-07" };
    expect([mixed, daysAndFrom, fromOnly, toOnly]).toHaveLength(4);
  });
});
