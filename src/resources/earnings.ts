import type { APIClient } from "../client.js";
import type {
  EarningsReactionsResponse,
  EarningsStatistics,
  EarningsQuarter,
  GetEarningsStatisticsOptions,
  GetEarningsSummariesOptions,
  GetRankedEarningsOptions,
  GetRecentEarningsOptions,
  PreviewResponse,
  RankedEarnings,
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

  /**
   * Measured price reactions to a ticker's last earnings reports, newest first.
   *
   * Use this after {@link getRecent} when you need one company's realized
   * post-report history. `client.calendar.getEarnings()` is the forward-looking
   * schedule instead. This endpoint returns its payload directly, without a
   * preview envelope, and every API key receives the full series.
   *
   * `timing` is always present on each row and can be `null` when the reacting
   * session was inferred rather than observed.
   */
  async getReactions(ticker: string): Promise<EarningsReactionsResponse> {
    return this.client.get(
      `/api/v1/stocks/${encodeURIComponent(ticker.toUpperCase())}/earnings/reactions`,
    );
  }

  /**
   * Market-wide earnings outcomes and realized reaction statistics.
   *
   * Use this for aggregate beat, miss, inline, and post-report move rates.
   * {@link getRecent} returns individual recent reports, while
   * `client.calendar.getEarnings()` covers upcoming dates. The response uses
   * the preview envelope, but every API key receives the full body and
   * `isPreview` is always `false`.
   *
   * `baseline` and `deviation` are omitted for long-span windows, and rates can
   * be `null` when their denominator is zero.
   */
  async getStatistics(
    options?: GetEarningsStatisticsOptions,
  ): Promise<PreviewResponse<EarningsStatistics>> {
    return this.client.get("/api/v1/earnings/statistics", options);
  }

  /**
   * Important recently reported and upcoming earnings in one ranking.
   *
   * Use this to prioritize a cross-ticker sweep. Follow reported rows with
   * {@link getReactions} for realized history; use {@link getRecent} for an
   * unranked recent feed or `client.calendar.getEarnings()` for the broader
   * forward schedule.
   *
   * A PRO key receives the full ranking. A FREE key receives the first three
   * rows in each section with `totalInWindow` left intact. Optional row fields
   * are omitted when null, so check them before use.
   */
  async getRanked(
    options?: GetRankedEarningsOptions,
  ): Promise<PreviewResponse<RankedEarnings>> {
    return this.client.get("/api/v1/earnings/ranked", options);
  }
}
