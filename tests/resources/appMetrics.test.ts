import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense from "../../src/index.js";
import type { MetricType, ServingMetric } from "../../src/index.js";

/**
 * The four App Store series are plain `getMetrics` metric types, so what is worth gating is
 * that each name reaches the right path and that the two payload shapes read the way the
 * README says: a count nests its scalar at `metricValue.value`, an average one level deeper
 * at `metricValue.value.value`, and both carry the flat `value`. The points below are
 * trimmed copies of the live shapes with synthetic numbers.
 */

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const client = new SentiSense({ apiKey: "test-key", maxRetries: 0 });

const APP_METRICS: MetricType[] = [
  "app_review_count",
  "app_rating",
  "app_all_ratings_count",
  "app_all_ratings_avg",
];

const COUNT_POINT = {
  timestamp: 1_760_000_000_000,
  metricType: "APP_ALL_RATINGS_COUNT",
  metricValue: { type: "CountMetricValue", value: 1200, count: 1200 },
  value: 1200,
};

const AVERAGE_POINT = {
  timestamp: 1_760_000_000_000,
  metricType: "APP_ALL_RATINGS_AVG",
  metricValue: {
    type: "ValueMetricValue",
    value: { valueType: "double", value: 4.5 },
    valueType: "MEAN",
  },
  value: 4.5,
};

describe("entityMetrics.getMetrics with the App Store metrics", () => {
  it.each(APP_METRICS)("requests %s on the metric path", async (metricType) => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.entityMetrics.getMetrics("Instagram", { metricType });
    expect(mockFetch.mock.calls[0][0]).toContain(
      `/api/v2/metrics/entity/Instagram/metric/${metricType}`,
    );
  });

  it("passes the time window through unchanged", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.entityMetrics.getMetrics("Instagram", {
      metricType: "app_all_ratings_count",
      startTime: 1_759_000_000_000,
      endTime: 1_760_000_000_000,
    });
    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain("startTime=1759000000000");
    expect(url).toContain("endTime=1760000000000");
  });

  it("reads a count at the flat value and at metricValue.value", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([COUNT_POINT]));
    const points: ServingMetric[] = await client.entityMetrics.getMetrics("Instagram", {
      metricType: "app_all_ratings_count",
    });
    expect(points[0].value).toBe(1200);
    expect(points[0].metricValue?.value).toBe(1200);
  });

  it("reads an average at the flat value and one level deeper", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([AVERAGE_POINT]));
    const points: ServingMetric[] = await client.entityMetrics.getMetrics("Instagram", {
      metricType: "app_all_ratings_avg",
    });
    expect(points[0].value).toBe(4.5);
    expect(points[0].metricValue?.value).toEqual({ valueType: "double", value: 4.5 });
  });

  it("returns an empty list when the window has no points", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    const points = await client.entityMetrics.getMetrics("Instagram", {
      metricType: "app_review_count",
    });
    expect(points).toEqual([]);
  });
});
