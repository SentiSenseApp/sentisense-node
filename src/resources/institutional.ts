import type { APIClient } from "../client.js";
import type {
  GetFlowsOptions,
  GetHoldersHistoryOptions,
  GetHoldersOptions,
  Holder,
  HoldersHistory,
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

  /**
   * Get available 13F reporting quarters, newest first.
   *
   * The first entry is usually the quarter that is still filing, so pick by the flag rather
   * than by position: `quarters.find((q) => !q.pending)?.reportDate`. Each row also carries
   * `ownershipEligible` and `ownershipEligibleAt`.
   */
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
   * `reportDate` is optional: omit it (or pass `undefined` ahead of `options`) and the
   * request carries no date, so the server serves this ticker's latest settled quarter,
   * echoes it in `data.reportDate` with `data.selection.mode` set to `DEFAULT`, and reports
   * any newer still-filing quarter separately in `data.earlyFilers`.
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
   * `limit` is the switch for the whole option set. With it, the response also carries
   * `returnedCount`, `offset`, and a `notableChanges` summary, so you can walk the list
   * without re-counting it. Without it, `offset` / `sortBy` / `sortDir` are ignored by the
   * server and you get the full unsorted list back with a 200.
   *
   * The payload also says how its quarter was chosen (`selection`), reports a newer
   * still-filing quarter separately (`earlyFilersStatus`, `earlyFilers`), lists well-known
   * institutions matched against the full roster (`notableHolders`), and summarizes the
   * quarter-over-quarter comparison (`comparisonReportDate`, `comparisonStatus`). Each
   * holder row has its own `comparisonStatus`; only `AVAILABLE` on that row supports its
   * change figures.
   */
  async getHolders(
    ticker: string,
    reportDate?: string,
    options?: GetHoldersOptions,
  ): Promise<PreviewResponse<TickerHolders>> {
    return this.client.get(
      `/api/v1/institutional/holders/${encodeURIComponent(ticker)}`,
      { reportDate, ...options },
    );
  }

  /**
   * Get a stock's institutional ownership quarter by quarter, newest first.
   *
   * Returns the preview envelope wrapping a {@link HoldersHistory} object, so the rows are
   * two levels down: `(await getHoldersHistory(t)).data.quarters`. Each row carries the
   * holder count, the share of the class institutions held (`institutionalOwnershipPct`),
   * and the quarter's net shares bought or sold, dollar flow and position counts.
   *
   * The newest quarter can still be filing (`status: "filing"`), in which case its figures
   * cover only the institutions that have filed so far. Quarters in which the security had
   * no holdings are omitted.
   *
   * Free keys receive the newest four quarters with `isPreview: true` and `totalCount`
   * holding the number of quarters in the full window. PRO receives the whole window
   * without `totalCount`.
   *
   * Share classes are answered separately (`GOOG` and `GOOGL`, `BRK.A` and `BRK.B`).
   *
   * @example
   * const { data } = await client.institutional.getHoldersHistory("AAPL", { quarters: 8 });
   * for (const q of data.quarters) console.log(q.label, q.status, q.institutionalOwnershipPct);
   */
  async getHoldersHistory(
    ticker: string,
    options?: GetHoldersHistoryOptions,
  ): Promise<PreviewResponse<HoldersHistory>> {
    return this.client.get(
      `/api/v1/institutional/holders/${encodeURIComponent(ticker)}/history`,
      { ...options },
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
   *
   * The signature remains unknown for compatibility. Opt in to the exported
   * PreviewResponse<InstitutionDetail> type to read data.positionsHeld, the full
   * portfolio count excluding SOLD_OUT rows, even on a truncated holdings list.
   */
  async getInstitutionDetail(slugOrCik: string): Promise<unknown> {
    return this.client.get(
      `/api/v1/institutional/institution/${encodeURIComponent(slugOrCik)}`,
    );
  }
}
