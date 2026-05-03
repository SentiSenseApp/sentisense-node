import type { APIClient } from "../client.js";
import type {
  Insight,
  InsightPreviewResponse,
  GetInsightsOptions,
} from "../types.js";

export interface GetStockInsightsRangeOptions {
  startDate: string;
  endDate: string;
  urgency?: "low" | "medium" | "high";
  insightType?: string;
}

export interface GetLatestInsightsOptions {
  limit?: number;
  urgency?: "low" | "medium" | "high";
}

export interface GetUserInsightsOptions {
  limit?: number;
  category?: string;
}

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
   * Get AI insights for a stock within a date range.
   *
   * Free users receive the top 3; PRO users receive the full list.
   * The server returns 400 if `startDate` is after `endDate`.
   */
  async stockRange(
    ticker: string,
    options: GetStockInsightsRangeOptions,
  ): Promise<Insight[] | InsightPreviewResponse> {
    return this.client.get(
      `/api/v1/insights/stock/${encodeURIComponent(ticker.toUpperCase())}/range`,
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
   * Get the latest AI insights across all tracked stocks, newest first.
   *
   * Free users receive the top 5; PRO users receive up to `limit` (clamped to 1-200).
   */
  async latest(
    options?: GetLatestInsightsOptions,
  ): Promise<Insight[] | InsightPreviewResponse> {
    return this.client.get("/api/v1/insights/latest", options);
  }

  /**
   * Get personalized insights for the authenticated user.
   *
   * Biased toward the user's watchlist and portfolio when available; falls back
   * to market-level insights otherwise. API key authentication required.
   */
  async user(
    options?: GetUserInsightsOptions,
  ): Promise<Insight[] | InsightPreviewResponse> {
    return this.client.get("/api/v1/insights/user", options);
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
