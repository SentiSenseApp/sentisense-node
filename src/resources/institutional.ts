import type { APIClient } from "../client.js";
import type {
  GetFlowsOptions,
  GetHoldersOptions,
  Holder,
  InstitutionList,
  InstitutionListResponse,
  InstitutionalFlows,
  ListInstitutionsOptions,
  PreviewResponse,
  Quarter,
  TickerHolders,
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
   *
   * Returns the preview envelope, so the flows are one level down:
   * `const { data } = await client.institutional.getFlows(); data.inflows`.
   */
  async getFlows(
    reportDate?: string,
    options?: GetFlowsOptions,
  ): Promise<PreviewResponse<InstitutionalFlows>> {
    return this.client.get("/api/v1/institutional/flows", {
      reportDate,
      ...options,
    });
  }

  /**
   * Get institutional holders for a specific stock.
   *
   * Returns the preview envelope wrapping a {@link TickerHolders} object, so the rows
   * are two levels down: `(await getHolders(t, d)).data.holders`, alongside ticker-level
   * totals like `holderCount`. Free callers get a truncated `holders` array with
   * `isPreview: true`.
   *
   * A widely held ticker returns thousands of rows: a megacap quarter is about
   * 6,000 holders and 1.5 MB. Pass `limit` unless you really want all of them.
   * Omitting `options` sends the original unbounded request.
   *
   * Paged responses also carry `returnedCount` and `offset` alongside the holder
   * rows, so you can walk the list without re-counting it yourself.
   */
  async getHolders(
    ticker: string,
    reportDate: string,
    options?: GetHoldersOptions,
  ): Promise<PreviewResponse<TickerHolders>> {
    return this.client.get(
      `/api/v1/institutional/holders/${encodeURIComponent(ticker)}`,
      { reportDate, ...options },
    );
  }

  /**
   * Get activist investor positions (NEW or INCREASED).
   *
   * Returns the preview envelope, so read the rows as `.data`.
   */
  async getActivists(reportDate: string): Promise<PreviewResponse<Holder[]>> {
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
