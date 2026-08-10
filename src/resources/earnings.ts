import type { APIClient } from "../client.js";
import type {
  EarningsQuarter,
  GetEarningsSummariesOptions,
  GetRecentEarningsOptions,
  PreviewResponse,
  RecentEarningsEntry,
} from "../types.js";

/**
 * Earnings: what a company actually reported, after the fact.
 *
 * A quarter's results arrive as a press release, a filing, and a call, none of
 * which is a data structure. {@link getSummaries} is the assembled version, one
 * object per fiscal quarter, and {@link getRecent} is the cross-ticker view of
 * who reported lately. Pair them to drive a post-earnings sweep: list the
 * window, then pull each ticker's analysis report.
 *
 * The forward-looking half of the family lives on `client.calendar.getEarnings()`,
 * which covers scheduled dates and consensus EPS rather than results.
 *
 * @see EarningsQuarter
 */
export class Earnings {
  constructor(private client: APIClient) {}

  /**
   * Per-quarter earnings analysis report for one ticker, newest first.
   *
   * Each quarter carries the editorial headline, the KPI cards that matter for
   * that company with year-over-year deltas, the guidance language as
   * management phrased it, and a summary of the earnings call.
   *
   * Branch on `isPreview`: a PRO key receives every hydrated quarter in full, a
   * FREE key receives the latest quarter shaped rather than truncated, plus
   * `totalCount`. {@link EarningsQuarter} documents which fields each tier
   * carries.
   *
   * A quarter typically appears within 48 hours of the company reporting, and
   * the call summary can arrive after the press-release content for the same
   * quarter, so read `generatedAt` and `transcriptGeneratedAt` rather than
   * assuming a fixed lag. A ticker with no stored quarter answers with an empty
   * `data` array, not a 404.
   *
   * Use canonical ticker symbols: `GOOGL` (not `GOOG`), `BRK.B` (not `BRK-B`).
   */
  async getSummaries(
    ticker: string,
    options?: GetEarningsSummariesOptions,
  ): Promise<PreviewResponse<EarningsQuarter[]>> {
    return this.client.get(
      `/api/v1/stocks/${encodeURIComponent(ticker.toUpperCase())}/earnings-summaries`,
      options,
    );
  }

  /**
   * Which covered companies reported on or after `today - days`, newest first.
   *
   * Every API key receives the full window it asks for, so `isPreview` is
   * always `false` here. The window is bounded by `reportDate`, so a quarter
   * reported inside it appears even when its call summary lands later, and an
   * empty `data` array means nobody in the covered set reported in that window.
   *
   * This is the backward-looking feed; `client.calendar.getEarnings()` is the
   * forward-looking one.
   */
  async getRecent(
    options?: GetRecentEarningsOptions,
  ): Promise<PreviewResponse<RecentEarningsEntry[]>> {
    return this.client.get("/api/v1/earnings/recent", options);
  }
}
