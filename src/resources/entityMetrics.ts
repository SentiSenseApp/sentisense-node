import type { APIClient } from "../client.js";
import { pathSegment } from "../pathSegment.js";
import type {
  MetricType,
  MetricsOptions,
  MetricDistributionOptions,
  ServingMetric,
  MetricDistribution,
  MetricSlice,
  NewsCountsOptions,
  EventCounts,
  HeadlineScores,
  PreviewResponse,
} from "../types.js";

/** The window query of the news-count methods: only the keys the caller set. */
function newsWindow(options: NewsCountsOptions): Record<string, string | number> {
  const { days, from, to } = options;
  return {
    ...(days !== undefined && { days }),
    ...(from !== undefined && { from }),
    ...(to !== undefined && { to }),
  };
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
      `/api/v2/metrics/entity/${pathSegment("entityMetrics.getMetrics", "symbol", symbol)}/metric/${pathSegment("entityMetrics.getMetrics", "options.metricType", metricType)}`,
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
      `/api/v2/metrics/entity/${pathSegment("entityMetrics.getDistribution", "symbol", symbol)}/distribution/${pathSegment("entityMetrics.getDistribution", "metricType", metricType)}`,
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
    return this.client.get(
      `/api/v2/metrics/entity/${pathSegment("entityMetrics.getSlices", "symbol", symbol)}/metric/${pathSegment("entityMetrics.getSlices", "metricType", metricType)}/slices`,
    );
  }

  /**
   * Get daily news event counts for a stock or entity.
   *
   * Per closed US Eastern day: the news headlines tagged to the entity, how many our events model
   * classified, how many report no event, and how many fall in each category (results, product
   * news, analyst actions, deals, legal, people, macro). `data.categories` lists each category
   * with the story event types it groups. These are daily counts: no single headline's event type
   * is returned. Today is never served, and a day not counted yet is absent (`data.asOf` is the
   * newest day served).
   *
   * A PRO key receives the window asked for. A free key receives the last 7 closed days whatever
   * it asks for, with `isPreview: true`. Each call counts against the monthly quota.
   *
   * @param symbol  Ticker symbol (e.g. "AAPL") or entity urlSlug.
   * @param options `days` (1 to 90, default 30), or `from` and `to` as `"YYYY-MM-DD"`.
   * @throws {SentiSenseError} Before any request, when `symbol` is empty, whitespace only, `"."`
   *         or `".."`.
   */
  async getEventCounts(
    symbol: string,
    options: NewsCountsOptions = {},
  ): Promise<PreviewResponse<EventCounts>> {
    return this.client.get(
      `/api/v2/metrics/entity/${pathSegment("entityMetrics.getEventCounts", "symbol", symbol)}/event-counts`,
      newsWindow(options),
    );
  }

  /**
   * Get daily news event counts for the whole market: every news headline of the day, each
   * counted once, with `data.entity` set to `"market"`. Same window options, response and free
   * preview as `getEventCounts()`.
   *
   * @param options `days` (1 to 90, default 30), or `from` and `to` as `"YYYY-MM-DD"`.
   */
  async getMarketEventCounts(options: NewsCountsOptions = {}): Promise<PreviewResponse<EventCounts>> {
    return this.client.get("/api/v2/metrics/market/event-counts", newsWindow(options));
  }

  /**
   * Get daily headline score counts for a stock or entity.
   *
   * Per closed US Eastern day: how many of the entity's news headlines our decision models scored,
   * how many scored strongly on each score (`UNCERTAINTY`, `PROMOTION`, `RESOLUTION`), and the
   * count at each level. `data.scores` defines each score: `strongFrom` on the 0 to 100 scale and
   * its levels. These are daily counts, not the SentiSense Score, and no single headline's score is
   * returned. `strongHeadlines` counts a headline once however many scores were strong on it.
   *
   * A PRO key receives the window asked for. A free key receives the last 7 closed days whatever
   * it asks for, with `isPreview: true`. Each call counts against the monthly quota.
   *
   * @param symbol  Ticker symbol (e.g. "AAPL") or entity urlSlug.
   * @param options `days` (1 to 90, default 30), or `from` and `to` as `"YYYY-MM-DD"`.
   * @throws {SentiSenseError} Before any request, when `symbol` is empty, whitespace only, `"."`
   *         or `".."`.
   */
  async getHeadlineScores(
    symbol: string,
    options: NewsCountsOptions = {},
  ): Promise<PreviewResponse<HeadlineScores>> {
    return this.client.get(
      `/api/v2/metrics/entity/${pathSegment("entityMetrics.getHeadlineScores", "symbol", symbol)}/headline-scores`,
      newsWindow(options),
    );
  }

  /**
   * Get daily headline score counts for the whole market: every news headline of the day, each
   * counted once, with `data.entity` set to `"market"`. Same window options, response and free
   * preview as `getHeadlineScores()`.
   *
   * @param options `days` (1 to 90, default 30), or `from` and `to` as `"YYYY-MM-DD"`.
   */
  async getMarketHeadlineScores(
    options: NewsCountsOptions = {},
  ): Promise<PreviewResponse<HeadlineScores>> {
    return this.client.get("/api/v2/metrics/market/headline-scores", newsWindow(options));
  }
}
