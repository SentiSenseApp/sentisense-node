import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import SentiSense, { SentiSenseError, type MetricSlice, type MetricType } from "../../src/index.js";

/** Metric slices. The fixture is synthetic values in the served shape (same keys). */

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

function requestedUrl(call = 0): URL {
  return new URL(String(mockFetch.mock.calls[call][0]));
}

const SLICES = JSON.parse(
  readFileSync(fileURLToPath(new URL("../fixtures/metric_slices.json", import.meta.url)), "utf8"),
) as MetricSlice[];

/** Every declared key, checked against the interface by `satisfies`. */
const SLICE_KEYS = {
  metricType: true,
  dimension: true,
  values: true,
  displayName: true,
} satisfies Record<keyof MetricSlice, true>;

describe("entityMetrics.getSlices", () => {
  it("calls the slices path with no query", async () => {
    respond(SLICES);
    await client.entityMetrics.getSlices("AAPL", "mentions");
    const url = requestedUrl();
    expect(url.pathname).toBe("/api/v2/metrics/entity/AAPL/metric/mentions/slices");
    expect(url.search).toBe("");
  });

  it("encodes the entity and the metric type as one path segment each", async () => {
    respond([]);
    await client.entityMetrics.getSlices("AT&T", "sentiment");
    expect(requestedUrl(0).pathname).toBe("/api/v2/metrics/entity/AT%26T/metric/sentiment/slices");

    respond([]);
    await client.entityMetrics.getSlices("Example Entity", "odd/metric" as MetricType);
    expect(requestedUrl(1).pathname).toBe(
      "/api/v2/metrics/entity/Example%20Entity/metric/odd%2Fmetric/slices",
    );
  });

  it("keeps reserved characters from turning the rest of the path into a query or fragment", async () => {
    respond([]);
    await client.entityMetrics.getSlices("AAPL", "sentiment?x=y" as MetricType);
    const query = requestedUrl(0);
    expect(query.pathname).toBe("/api/v2/metrics/entity/AAPL/metric/sentiment%3Fx%3Dy/slices");
    expect(query.search).toBe("");

    respond([]);
    await client.entityMetrics.getSlices("AAPL#ignored", "sentiment");
    const fragment = requestedUrl(1);
    expect(fragment.pathname).toBe("/api/v2/metrics/entity/AAPL%23ignored/metric/sentiment/slices");
    expect(fragment.hash).toBe("");
  });

  it.each(["", "   ", ".", ".."])(
    "rejects symbol %j before any request, since it cannot fill its path slot",
    async (bad) => {
      const call = client.entityMetrics.getSlices(bad, "mentions");
      await expect(call).rejects.toBeInstanceOf(SentiSenseError);
      await expect(call).rejects.toThrow(
        `entityMetrics.getSlices: symbol must not be empty, "." or ".." (got ${JSON.stringify(bad)})`,
      );
      await expect(call).rejects.toMatchObject({ status: undefined, code: "invalid_argument" });
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );

  it.each(["", "   ", ".", ".."])(
    "rejects metricType %j before any request, since it cannot fill its path slot",
    async (bad) => {
      const call = client.entityMetrics.getSlices("AAPL", bad as MetricType);
      await expect(call).rejects.toBeInstanceOf(SentiSenseError);
      await expect(call).rejects.toThrow(
        `entityMetrics.getSlices: metricType must not be empty, "." or ".." (got ${JSON.stringify(bad)})`,
      );
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );

  it("still sends a normal call and a value that merely contains dots, each in its own slot", async () => {
    respond([]);
    await client.entityMetrics.getSlices("AAPL", "mentions");
    expect(requestedUrl(0).pathname).toBe("/api/v2/metrics/entity/AAPL/metric/mentions/slices");

    respond([]);
    await client.entityMetrics.getSlices("BRK.B", "mentions");
    expect(requestedUrl(1).pathname).toBe("/api/v2/metrics/entity/BRK.B/metric/mentions/slices");

    respond([]);
    await client.entityMetrics.getSlices("...", "mentions");
    expect(requestedUrl(2).pathname).toBe("/api/v2/metrics/entity/.../metric/mentions/slices");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("returns the slice rows as a plain array", async () => {
    respond(SLICES);
    const slices = await client.entityMetrics.getSlices("AAPL", "mentions");
    expectTypeOf(slices).toEqualTypeOf<MetricSlice[]>();
    expect(slices).toEqual(SLICES);
    expect(slices.find((s) => s.dimension === "source")?.values).toContain("Reddit");
  });

  it("returns an empty array when the metric has no slices", async () => {
    respond([]);
    const slices = await client.entityMetrics.getSlices("Example-Entity", "sentisense_rating");
    expect(slices).toEqual([]);
  });

  it("declares every key the served row has, and nothing more", () => {
    for (const slice of SLICES) {
      expect(Object.keys(slice).sort()).toEqual(Object.keys(SLICE_KEYS).sort());
    }
  });
});

describe("entityMetrics.getSlices today", () => {
  /** What the API returns today for every entity and metric: the type marker alone (displayName illustrative). */
  const TYPE_MARKER = [{ metricType: "mentions", dimension: "type", values: ["root"], displayName: "Type" }];

  it("passes the type marker through untouched", async () => {
    respond(TYPE_MARKER);
    const slices = await client.entityMetrics.getSlices("AAPL", "mentions");
    expect(slices).toEqual(TYPE_MARKER);
    expect(slices.map((s) => s.dimension)).not.toContain("source");
  });

  it("documents what it returns today and points at getDistribution for sources", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../../src/resources/entityMetrics.ts", import.meta.url)),
      "utf8",
    );
    const match = source.match(/\/\*\*((?:(?!\/\*\*)[\s\S])*?)\*\/\s*async getSlices\(/);
    expect(match, "no JSDoc found above getSlices").not.toBeNull();
    const doc = (match?.[1] ?? "").replace(/\n\s*\*/g, " ").replace(/\s+/g, " ");
    expect(doc).toContain('`[{ dimension: "type", values: ["root"] }]`');
    expect(doc).toContain('pass `"source"` to `getDistribution()` directly');
    // The old wording promised discovery the route does not deliver.
    expect(doc).not.toMatch(/see what exists before calling/i);
  });
});
