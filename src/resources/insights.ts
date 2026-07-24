import type { APIClient } from "../client.js";
import type {
  Insight,
  GetInsightsOptions,
  PreviewResponse,
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
   * Returns the preview envelope: read the insights as `.data`. PRO callers get the
   * full list with `isPreview: false`; free callers get the top 3 with `isPreview: true`
   * and `totalCount` carrying the untruncated size.
   */
  async stock(
    ticker: string,
    options?: GetInsightsOptions,
  ): Promise<PreviewResponse<Insight[]>> {
    return this.client.get(
      `/api/v1/insights/stock/${encodeURIComponent(ticker.toUpperCase())}`,
      options,
    );
  }

  /**
   * Get AI insights for a stock within a date range.
   *
   * Returns the preview envelope: read the insights as `.data`. Free callers receive
   * the top 3, PRO callers the full list. The server returns 400 if `startDate` is
   * after `endDate`.
   */
  async stockRange(
    ticker: string,
    options: GetStockInsightsRangeOptions,
  ): Promise<PreviewResponse<Insight[]>> {
    return this.client.get(
      `/api/v1/insights/stock/${encodeURIComponent(ticker.toUpperCase())}/range`,
      options,
    );
  }

  /**
   * Get AI-generated market-level insights, sorted by urgency then confidence.
   *
   * Returns the preview envelope: read the insights as `.data`. PRO callers get the
   * full list with `isPreview: false`; free callers get the top 5 with `isPreview: true`
   * and `totalCount` carrying the untruncated size.
   */
  async market(): Promise<PreviewResponse<Insight[]>> {
    return this.client.get("/api/v1/insights/market");
  }

  /**
   * Get the latest AI insights across all tracked stocks, newest first.
   *
   * Returns the preview envelope: read the insights as `.data`. Free callers receive
   * the top 5, PRO callers up to `limit` (clamped to 1-200).
   */
  async latest(
    options?: GetLatestInsightsOptions,
  ): Promise<PreviewResponse<Insight[]>> {
    return this.client.get("/api/v1/insights/latest", options);
  }

  /**
   * Get personalized insights for the authenticated user.
   *
   * Biased toward the user's watchlist and portfolio when available; falls back
   * to market-level insights otherwise. API key authentication required.
   * Returns the preview envelope: read the insights as `.data`.
   */
  async user(
    options?: GetUserInsightsOptions,
  ): Promise<PreviewResponse<Insight[]>> {
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
