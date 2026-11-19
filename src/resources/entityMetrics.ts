import type { APIClient } from "../client.js";
import { SentiSenseError } from "../errors.js";
import type {
  MetricType,
  MetricsOptions,
  MetricDistributionOptions,
  ServingMetric,
  MetricDistribution,
  MetricSlice,
} from "../types.js";

/**
 * A path argument must fill its own segment. An empty value leaves the segment blank, and a
 * standalone "." or ".." is removed by URL normalization, which sends the request to a
 * different route. Reject those before any request is made.
 */
function requirePathSegment(method: string, name: string, value: unknown): string {
  if (typeof value !== "string" || value.trim() === "" || value === "." || value === "..") {
    throw new SentiSenseError(
      `${method}: ${name} must not be empty, "." or ".." (got ${JSON.stringify(value)})`,
    );
  }
  return value;
}

export class EntityMetrics {
  constructor(private client: APIClient) {}

  /**
   * Get time-series metric data for an entity using the v2 Serving Metrics API.
   *
   * @param symbol   Ticker symbol (e.g. "AAPL") or entity urlSlug (e.g. "Nancy-Pelosi",
   *                 case-insensitive; discover slugs via stocks.getEntities()).
   * @param options  Metric type and optional time range / resolution. The App Store metrics
   *                 (`app_review_count`, `app_rating`, `app_all_ratings_count`,
   *                 `app_all_ratings_avg`) apply to product entities with a tracked app, so pass
   *                 an entity slug such as "Instagram", not a ticker.
   */
  async getMetrics(
    symbol: string,
    options: MetricsOptions = {},
  ): Promise<ServingMetric[]> {
    const { metricType = "sentiment", startTime, endTime, maxDataPoints } = options;
    return this.client.get(
      `/api/v2/metrics/entity/${encodeURIComponent(symbol)}/metric/${encodeURIComponent(metricType)}`,
      {
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(maxDataPoints !== undefined && { maxDataPoints }),
      },
    );
  }

  /**
   * Get a metric broken down by dimension (default dimension: source).
   *
   * `valueType` on the response says what each number in `distribution` is. For a count metric
   * such as `"mentions"` it is `"SHARE_PERCENT"`: each source's percentage share of the total,
   * summing to about 100. For `"sentiment"` it is `"MEAN"`: each source's mean polarity over the
   * window, in [-1, 1]. `"sentisense_score"` has no per-source split and answers with an empty
   * distribution.
   *
   * @param symbol     Ticker symbol (e.g. "AAPL") or entity urlSlug.
   * @param metricType The metric to break down (e.g. "mentions" or "sentiment").
   * @param options    Optional dimension, and an optional window as `startTime` / `endTime` in
   *                   epoch milliseconds. Without a window the API uses the last 7 days.
   */
  async getDistribution(
    symbol: string,
    metricType: MetricType,
    options: MetricDistributionOptions = {},
  ): Promise<MetricDistribution> {
    const { dimension = "source", startTime, endTime } = options;
    return this.client.get(
      `/api/v2/metrics/entity/${encodeURIComponent(symbol)}/distribution/${encodeURIComponent(metricType)}`,
      {
        dimension,
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
      },
    );
  }

  /**
   * List the slices the API reports for one entity's metric.
   *
   * Today it returns only the entity's own type marker, `[{ dimension: "type", values: ["root"] }]`,
   * for every entity and metric. It does not list `"source"` or `"publisher"`, which
   * `getDistribution()` accepts, so it cannot tell you what a metric breaks down by. To break a
   * metric down by source, pass `"source"` to `getDistribution()` directly.
   *
   * Returns a plain array. Available on every tier; each call counts against the monthly quota.
   *
   * @param symbol     Ticker symbol (e.g. "AAPL") or entity urlSlug (e.g. "Nancy-Pelosi").
   * @param metricType The metric to look up (e.g. "mentions").
   * @throws {SentiSenseError} Before any request, when `symbol` or `metricType` is empty,
   *         whitespace only, `"."` or `".."`.
   */
  async getSlices(symbol: string, metricType: MetricType): Promise<MetricSlice[]> {
    const entity = requirePathSegment("entityMetrics.getSlices", "symbol", symbol);
    const metric = requirePathSegment("entityMetrics.getSlices", "metricType", metricType);
    return this.client.get(
      `/api/v2/metrics/entity/${encodeURIComponent(entity)}/metric/${encodeURIComponent(metric)}/slices`,
    );
  }
}
