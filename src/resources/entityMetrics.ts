import type { APIClient } from "../client.js";
import type {
  EntityMetricsDateRange,
  GetMentionCountOptions,
  GetMentionsOptions,
  GetSentimentBySourceOptions,
  MentionCount,
  MentionData,
  SentimentData,
} from "../types.js";

export class EntityMetrics {
  constructor(private client: APIClient) {}

  /** Get mention data for a stock. */
  async getMentions(symbol: string, options?: GetMentionsOptions): Promise<MentionData> {
    return this.client.get(
      `/api/v1/entity-metrics/stocks/${encodeURIComponent(symbol)}/mentions`,
      options,
    );
  }

  /** Get mention counts broken down by source. */
  async getMentionCountBySource(
    symbol: string,
    options?: EntityMetricsDateRange,
  ): Promise<MentionCount> {
    return this.client.get(
      `/api/v1/entity-metrics/stocks/${encodeURIComponent(symbol)}/mentions/count/by-source`,
      options,
    );
  }

  /** Get total mention count. */
  async getMentionCount(symbol: string, options?: GetMentionCountOptions): Promise<MentionCount> {
    return this.client.get(
      `/api/v1/entity-metrics/stocks/${encodeURIComponent(symbol)}/mentions/count`,
      options,
    );
  }

  /** Get sentiment data for a stock. */
  async getSentiment(symbol: string, options?: EntityMetricsDateRange): Promise<SentimentData> {
    return this.client.get(
      `/api/v1/entity-metrics/stocks/${encodeURIComponent(symbol)}/sentiment`,
      options,
    );
  }

  /** Get sentiment broken down by source. */
  async getSentimentBySource(
    symbol: string,
    options?: GetSentimentBySourceOptions,
  ): Promise<SentimentData> {
    return this.client.get(
      `/api/v1/entity-metrics/stocks/${encodeURIComponent(symbol)}/sentiment/by-source`,
      options,
    );
  }

  /** Get average sentiment score. */
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
