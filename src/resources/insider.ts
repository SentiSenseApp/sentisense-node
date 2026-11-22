import type { APIClient } from "../client.js";
import type {
  InsiderActivityResponse,
  InsiderTrade,
  ClusterBuy,
  GetInsiderOptions,
  GetInsiderTradesOptions,
  PreviewResponse,
} from "../types.js";

export class Insider {
  constructor(private client: APIClient) {}

  /**
   * Get market-wide insider activity: top buys and sells aggregated by ticker.
   *
   * PRO-gated. Free-tier users receive a preview (top 5 per direction)
   * with `isPreview: true` in the response.
   */
  async getActivity(options?: GetInsiderOptions): Promise<PreviewResponse<InsiderActivityResponse>> {
    return this.client.get("/api/v1/insider/activity", options);
  }

  /**
   * Get individual insider transactions for a specific stock, newest first.
   *
   * PRO-gated. Free users receive a preview of the top 5 transactions.
   *
   * Pass `limit` for only the newest rows of the window: `totalCount` on the envelope then
   * holds the number of rows in the whole window, on every tier. The server caps `limit` at
   * 1000. Omit it for every row in the window.
   *
   * @example
   * const latest = await client.insider.getTrades("NVDA", { limit: 10 });
   * console.log(latest.data.length, "of", latest.totalCount);
   */
  async getTrades(ticker: string, options?: GetInsiderTradesOptions): Promise<PreviewResponse<InsiderTrade[]>> {
    return this.client.get(
      `/api/v1/insider/trades/${encodeURIComponent(ticker.toUpperCase())}`,
      options,
    );
  }

  /**
   * Get cluster buy signals: stocks where 3+ distinct insiders bought recently.
   *
   * PRO-gated. Free users receive a preview of the top 3 signals.
   */
  async getClusterBuys(options?: GetInsiderOptions): Promise<PreviewResponse<ClusterBuy[]>> {
    return this.client.get("/api/v1/insider/cluster-buys", options);
  }
}
