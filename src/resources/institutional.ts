import type { APIClient } from "../client.js";
import type {
  GetFlowsOptions,
  Holder,
  InstitutionList,
  InstitutionListResponse,
  InstitutionalFlowsResponse,
  ListInstitutionsOptions,
  Quarter,
} from "../types.js";

export class Institutional {
  constructor(private client: APIClient) {}

  /** Get available 13F reporting quarters. */
  async getQuarters(): Promise<Quarter[]> {
    return this.client.get("/api/v1/institutional/quarters");
  }

  /**
   * Get aggregate institutional activity per ticker for a quarter.
   *
   * `reportDate` is optional: omit it to get the latest available quarter, which may be
   * a still-open one holding only early filers. The response then carries `reportDate`
   * plus `isPending` and filer coverage counts so a partial quarter is clearly labeled.
   */
  async getFlows(reportDate?: string, options?: GetFlowsOptions): Promise<InstitutionalFlowsResponse> {
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
   * Discover institutions: a paginated, AUM-ranked list of filers (slug + metadata)
   * so you can find what to query without knowing slugs upfront.
   *
   * Each institution is rolled up by parent filer, so a multi-filer manager
   * (e.g. Vanguard) appears once with combined AUM. Summary only; use
   * `getInstitutionDetail` for a filer's full holdings.
   *
   * Requires an API key but does not consume monthly quota (per-minute rate
   * limits still apply). Returns the unwrapped list payload.
   */
  async listInstitutions(options?: ListInstitutionsOptions): Promise<InstitutionList> {
    const resp = await this.client.get<InstitutionListResponse>(
      "/api/v1/institutional/institutions",
      { ...options },
    );
    return resp.data;
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
