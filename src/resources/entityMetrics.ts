import type { APIClient } from "../client.js";
import type {
  MetricType,
  MetricsOptions,
  MetricDistributionOptions,
  ServingMetric,
  MetricDistribution,
} from "../types.js";

export class EntityMetrics {
  constructor(private client: APIClient) {}

  /**
   * Get time-series metric data for an entity using the v2 Serving Metrics API.
   *
   * @param symbol   Ticker symbol (e.g. "AAPL") or entity urlSlug (e.g. "Nancy-Pelosi",
   *                 case-insensitive; discover slugs via stocks.getEntities()).
   * @param options  Metric type and optional time range / resolution.
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
   * @param options    Optional dimension parameter.
   */
  async getDistribution(
    symbol: string,
    metricType: MetricType,
    options: MetricDistributionOptions = {},
  ): Promise<MetricDistribution> {
    const { dimension = "source" } = options;
    return this.client.get(
      `/api/v2/metrics/entity/${encodeURIComponent(symbol)}/distribution/${encodeURIComponent(metricType)}`,
      { dimension },
    );
  }
}
