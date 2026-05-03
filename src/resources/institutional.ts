import type { APIClient } from "../client.js";
import type {
  GetFlowsOptions,
  Holder,
  InstitutionalFlowsResponse,
  Quarter,
} from "../types.js";

export class Institutional {
  constructor(private client: APIClient) {}

  /** Get available 13F reporting quarters. */
  async getQuarters(): Promise<Quarter[]> {
    return this.client.get("/api/v1/institutional/quarters");
  }

  /** Get aggregate institutional activity per ticker for a quarter. */
  async getFlows(reportDate: string, options?: GetFlowsOptions): Promise<InstitutionalFlowsResponse> {
    return this.client.get("/api/v1/institutional/flows", {
      reportDate,
      ...options,
    });
  }

  /** Get institutional holders for a specific stock. */
  async getHolders(ticker: string, reportDate: string): Promise<Holder[]> {
    return this.client.get(
      `/api/v1/institutional/holders/${encodeURIComponent(ticker)}`,
      { reportDate },
    );
  }

  /** Get activist investor positions (NEW or INCREASED). */
  async getActivists(reportDate: string): Promise<Holder[]> {
    return this.client.get("/api/v1/institutional/activist", { reportDate });
  }

  /**
   * Get the full profile, summary stats, and current-quarter holdings for a
   * specific institutional filer.
   *
   * Resolved by URL slug (e.g. `Berkshire-Hathaway`) or numeric SEC CIK.
   * Free users receive the profile and top 10 holdings; PRO users receive the
   * full holdings array. Returns 404 if the slug or CIK is unknown.
   */
  async getInstitutionDetail(slugOrCik: string): Promise<unknown> {
    return this.client.get(
      `/api/v1/institutional/institution/${encodeURIComponent(slugOrCik)}`,
    );
  }
}
