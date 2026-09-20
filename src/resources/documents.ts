import type { APIClient } from "../client.js";
import type {
  DocumentSearchResponse,
  DocumentSource,
  GetByEntityOptions,
  GetBySourceOptions,
  GetByTickerOptions,
  GetByTickerRangeOptions,
  GetStoriesByTickerOptions,
  GetStoriesOptions,
  SearchDocumentsOptions,
  SearchStoriesOptions,
  Story,
} from "../types.js";

export class Documents {
  constructor(private client: APIClient) {}

  /** Get document metrics for a stock. The rows are in `documents`. */
  async getByTicker(ticker: string, options?: GetByTickerOptions): Promise<DocumentSearchResponse> {
    return this.client.get(`/api/v1/documents/ticker/${encodeURIComponent(ticker)}`, options);
  }

  /** Get document metrics for a stock within a date range. The rows are in `documents`. */
  async getByTickerRange(ticker: string, options: GetByTickerRangeOptions): Promise<DocumentSearchResponse> {
    return this.client.get(
      `/api/v1/documents/ticker/${encodeURIComponent(ticker)}/range`,
      options,
    );
  }

  /** Get document metrics for a KB entity. The rows are in `documents`. */
  async getByEntity(entityId: string, options?: GetByEntityOptions): Promise<DocumentSearchResponse> {
    return this.client.get(
      `/api/v1/documents/entity/${encodeURIComponent(entityId)}`,
      options,
    );
  }

  /** Smart search with natural language query parsing. The rows are in `documents`. */
  async search(query: string, options?: SearchDocumentsOptions): Promise<DocumentSearchResponse> {
    return this.client.get("/api/v1/documents/search", { query, ...options });
  }

  /** Get latest document metrics from a source type. The rows are in `documents`. */
  async getBySource(source: DocumentSource, options?: GetBySourceOptions): Promise<DocumentSearchResponse> {
    return this.client.get(
      `/api/v1/documents/source/${encodeURIComponent(source)}`,
      options,
    );
  }

  /** Get AI-curated news story clusters. */
  async getStories(options?: GetStoriesOptions): Promise<Story[]> {
    return this.client.get("/api/v1/documents/stories", options);
  }

  /**
   * Get full story detail by cluster ID.
   *
   * Deliberately untyped: narrow it yourself. The response carries `storySource` and
   * `isLive` alongside the story body, plus a `timeline` array of dated updates,
   * newest first and empty when the story has none. {@link StoryTimelineEntry} is
   * exported for that array.
   */
  async getStoryDetail(clusterId: string): Promise<unknown> {
    return this.client.get(`/api/v1/documents/stories/${encodeURIComponent(clusterId)}`);
  }

  /**
   * Free-text search across the AI-curated stories, newest first.
   *
   * The query is parsed like {@link Documents.search}: explicit entity ids first, then entities
   * recognised in the text, then the remaining words as keywords that must all appear in the
   * story's own title or summary. The rows are the same {@link Story} shape {@link
   * Documents.getStories} returns, so an `id` can go straight to {@link Documents.getStoryDetail}.
   */
  async searchStories(options: SearchStoriesOptions): Promise<Story[]> {
    return this.client.get("/api/v1/documents/stories/search", options);
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
