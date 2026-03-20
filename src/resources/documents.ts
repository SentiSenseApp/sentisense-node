import type { APIClient } from "../client.js";
import type {
  Document,
  DocumentSource,
  GetByEntityOptions,
  GetBySourceOptions,
  GetByTickerOptions,
  GetByTickerRangeOptions,
  GetStoriesByTickerOptions,
  GetStoriesOptions,
  SearchDocumentsOptions,
  Story,
} from "../types.js";

export class Documents {
  constructor(private client: APIClient) {}

  /** Get document metrics for a stock. */
  async getByTicker(ticker: string, options?: GetByTickerOptions): Promise<Document[]> {
    return this.client.get(`/api/v1/documents/ticker/${encodeURIComponent(ticker)}`, options);
  }

  /** Get document metrics for a stock within a date range. */
  async getByTickerRange(ticker: string, options: GetByTickerRangeOptions): Promise<Document[]> {
    return this.client.get(
      `/api/v1/documents/ticker/${encodeURIComponent(ticker)}/range`,
      options,
    );
  }

  /** Get document metrics for a KB entity. */
  async getByEntity(entityId: string, options?: GetByEntityOptions): Promise<Document[]> {
    return this.client.get(
      `/api/v1/documents/entity/${encodeURIComponent(entityId)}`,
      options,
    );
  }

  /** Smart search with natural language query parsing. */
  async search(query: string, options?: SearchDocumentsOptions): Promise<Document[]> {
    return this.client.get("/api/v1/documents/search", { query, ...options });
  }

  /** Get latest document metrics from a source type. */
  async getBySource(source: DocumentSource, options?: GetBySourceOptions): Promise<Document[]> {
    return this.client.get(
      `/api/v1/documents/source/${encodeURIComponent(source)}`,
      options,
    );
  }

  /** Get AI-curated news story clusters. */
  async getStories(options?: GetStoriesOptions): Promise<Story[]> {
    return this.client.get("/api/v1/documents/stories", options);
  }

  /** Get full story detail by cluster ID. */
  async getStoryDetail(clusterId: string): Promise<unknown> {
    return this.client.get(`/api/v1/documents/stories/${encodeURIComponent(clusterId)}`);
  }

  /** Get stories for a specific stock. */
  async getStoriesByTicker(
    ticker: string,
    options?: GetStoriesByTickerOptions,
  ): Promise<Story[]> {
    return this.client.get(
      `/api/v1/documents/stories/ticker/${encodeURIComponent(ticker)}`,
      options,
    );
  }

}
