import type { APIClient } from "../client.js";
import type {
  CongressTrade,
  PoliticianSummary,
  PoliticianDetail,
  GetPoliticiansOptions,
  PreviewResponse,
} from "../types.js";

export class Politicians {
  constructor(private client: APIClient) {}

  /**
   * Get recent congressional STOCK Act trading activity across all politicians.
   *
   * PRO-gated. Free/unauthenticated users receive a preview (top 5 trades)
   * with `isPreview: true` in the response.
   */
  async getActivity(
    options?: GetPoliticiansOptions,
  ): Promise<PreviewResponse<CongressTrade[]>> {
    return this.client.get("/api/v1/politicians/activity", options);
  }

  /**
   * Get congressional trades for a specific stock.
   *
   * PRO-gated. Free users receive a preview of the top 3 trades.
   */
  async getFilings(
    ticker: string,
    options?: GetPoliticiansOptions,
  ): Promise<PreviewResponse<CongressTrade[]>> {
    return this.client.get(
      `/api/v1/politicians/filings/${encodeURIComponent(ticker.toUpperCase())}`,
      options,
    );
  }

  /**
   * Get all tracked politicians with trading summary statistics.
   *
   * PRO-gated. Free users receive a preview of the top 5 members.
   */
  async getMembers(): Promise<PreviewResponse<PoliticianSummary[]>> {
    return this.client.get("/api/v1/politicians/members");
  }

  /**
   * Get detailed profile for a single politician: summary, recent trades, top tickers.
   *
   * PRO-gated. Free users receive a preview-wrapped response.
   */
  async getMember(slug: string): Promise<PreviewResponse<PoliticianDetail>> {
    return this.client.get(
      `/api/v1/politicians/member/${encodeURIComponent(slug)}`,
    );
  }
}
