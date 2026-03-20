import type { APIClient } from "../client.js";
import type {
  InsiderActivityResponse,
  InsiderTrade,
  ClusterBuy,
  GetInsiderOptions,
} from "../types.js";

export class Insider {
  constructor(private client: APIClient) {}

  /**
   * Get market-wide insider activity: top buys and sells aggregated by ticker.
   *
   * PRO-gated. Free/unauthenticated users receive a preview (top 5 per direction)
   * with `isPreview: true` in the response.
   */
  async getActivity(options?: GetInsiderOptions): Promise<InsiderActivityResponse> {
    return this.client.get("/api/v1/insider/activity", options);
  }

  /**
   * Get individual insider transactions for a specific stock.
   *
   * PRO-gated. Free users receive a preview of the top 5 transactions.
   */
  async getTrades(ticker: string, options?: GetInsiderOptions): Promise<InsiderTrade[]> {
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
  async getClusterBuys(options?: GetInsiderOptions): Promise<ClusterBuy[]> {
    return this.client.get("/api/v1/insider/cluster-buys", options);
  }
}
