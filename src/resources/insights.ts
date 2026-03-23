import type { APIClient } from "../client.js";
import type {
  Insight,
  InsightPreviewResponse,
  GetInsightsOptions,
} from "../types.js";

export class Insights {
  constructor(private client: APIClient) {}

  /**
   * Get AI-generated insights for a specific stock, sorted by urgency then confidence.
   *
   * PRO users receive a flat array of Insight objects.
   * Free/unauthenticated users receive a preview with `isPreview: true`,
   * the top 3 insights in full, and a `locked` array with metadata-only entries
   * (type, urgency, timestamp) showing what additional signals exist.
   */
  async stock(
    ticker: string,
    options?: GetInsightsOptions,
  ): Promise<Insight[] | InsightPreviewResponse> {
    return this.client.get(
      `/api/v1/insights/stock/${encodeURIComponent(ticker.toUpperCase())}`,
      options,
    );
  }

  /**
   * Get AI-generated market-level insights, sorted by urgency then confidence.
   *
   * PRO users receive a flat array of Insight objects.
   * Free/unauthenticated users receive a preview with `isPreview: true`,
   * the top 5 insights in full, and a `locked` array with metadata-only entries.
   */
  async market(): Promise<Insight[] | InsightPreviewResponse> {
    return this.client.get("/api/v1/insights/market");
  }

  /**
   * Get available insight types for a specific stock.
   * No authentication required.
   *
   * Returns an array of insight type strings (e.g., `["sentiment_shift", "options_activity"]`).
   */
  async types(ticker: string): Promise<string[]> {
    return this.client.get(
      `/api/v1/insights/stock/${encodeURIComponent(ticker.toUpperCase())}/types`,
    );
  }
}
