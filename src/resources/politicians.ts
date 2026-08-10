import type { APIClient } from "../client.js";
import type {
  CongressTrade,
  PoliticianSummary,
  PoliticianDetail,
  GetPoliticianActivityOptions,
  GetPoliticiansOptions,
  PreviewResponse,
} from "../types.js";

export class Politicians {
  constructor(private client: APIClient) {}

  /**
   * Get recent congressional STOCK Act trading activity across all politicians.
   *
   * PRO-gated. Free-tier users receive a preview (top 5 trades)
   * with `isPreview: true` in the response.
   *
   * The feed is longer than one response: a default 90-day window is routinely well over a
   * thousand disclosures, and without `limit` the server sends the first 200 with no marker
   * that it stopped. `totalCount` on the envelope is the real size on every tier, so page
   * with `limit` and `offset` rather than reading `data.length` as the total.
   *
   * ```typescript
   * const first = await client.politicians.getActivity({ limit: 100 });
   * for (let offset = 100; offset < first.totalCount!; offset += 100) {
   *   const page = await client.politicians.getActivity({ limit: 100, offset });
   *   // ... page.data
   * }
   * ```
   */
  async getActivity(
    options?: GetPoliticianActivityOptions,
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
