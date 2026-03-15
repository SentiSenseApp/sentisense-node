import type { APIClient } from "../client.js";
import type {
  EntityMetricsDateRange,
  GetMentionCountOptions,
  GetMentionsOptions,
  GetSentimentBySourceOptions,
  MentionCount,
  MentionData,
  MetricType,
  MetricsOptions,
  MetricDistributionOptions,
  SentimentData,
  ServingMetric,
  MetricDistribution,
} from "../types.js";

export class EntityMetrics {
  constructor(private client: APIClient) {}

  // ── v2 API methods ──────────────────────────────────────────

  /**
   * Get time-series metric data for an entity using the v2 Serving Metrics API.
   *
   * @param symbol   Ticker symbol (e.g. "AAPL") — the backend resolves the entity.
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
   * Get distribution data for a metric, broken down by a dimension (default: source).
   *
   * @param symbol     Ticker symbol (e.g. "AAPL").
   * @param metricType The metric to break down (e.g. "mentions", "sentiment").
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

  // ── Deprecated v1 methods (kept for backward compatibility) ─

  /**
   * @deprecated Use `getMetrics(symbol, { metricType: "mentions" })` instead.
   */
  async getMentions(symbol: string, options?: GetMentionsOptions): Promise<MentionData> {
    return this.client.get(
      `/api/v1/entity-metrics/stocks/${encodeURIComponent(symbol)}/mentions`,
      options,
    );
  }

  /**
   * @deprecated Use `getDistribution(symbol, "mentions", { dimension: "source" })` instead.
   */
  async getMentionCountBySource(
    symbol: string,
    options?: EntityMetricsDateRange,
  ): Promise<MentionCount> {
    return this.client.get(
      `/api/v1/entity-metrics/stocks/${encodeURIComponent(symbol)}/mentions/count/by-source`,
      options,
    );
  }

  /**
   * @deprecated Use `getMetrics(symbol, { metricType: "mentions" })` instead.
   */
  async getMentionCount(symbol: string, options?: GetMentionCountOptions): Promise<MentionCount> {
    return this.client.get(
      `/api/v1/entity-metrics/stocks/${encodeURIComponent(symbol)}/mentions/count`,
      options,
    );
  }

  /**
   * @deprecated Use `getMetrics(symbol, { metricType: "sentiment" })` instead.
   */
  async getSentiment(symbol: string, options?: EntityMetricsDateRange): Promise<SentimentData> {
    return this.client.get(
      `/api/v1/entity-metrics/stocks/${encodeURIComponent(symbol)}/sentiment`,
      options,
    );
  }

  /**
   * @deprecated Use `getDistribution(symbol, "sentiment", { dimension: "source" })` instead.
   */
  async getSentimentBySource(
    symbol: string,
    options?: GetSentimentBySourceOptions,
  ): Promise<SentimentData> {
    return this.client.get(
      `/api/v1/entity-metrics/stocks/${encodeURIComponent(symbol)}/sentiment/by-source`,
      options,
    );
  }

  /**
   * @deprecated Use `getMetrics(symbol, { metricType: "sentiment" })` instead.
   */
  async getAverageSentiment(
    symbol: string,
    options?: EntityMetricsDateRange,
  ): Promise<SentimentData> {
    return this.client.get(
      `/api/v1/entity-metrics/stocks/${encodeURIComponent(symbol)}/sentiment/average`,
      options,
    );
  }
}
