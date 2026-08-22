import type { APIClient } from "../client.js";
import type { OptionsOverview, PreviewResponse } from "../types.js";

/**
 * Market-wide options intelligence.
 *
 * Per-ticker options live on `client.stocks` (`getOptionsSummary`, `getOptionsHistory`),
 * next to everything else keyed by a symbol. This resource holds the surfaces that have no
 * ticker at all, the same split the market-wide mood and screener resources use.
 */
export class Options {
  constructor(private client: APIClient) {}

  /**
   * Get the market-wide options radar: where implied volatility, put/call flow and skew are
   * unusual today, ranked.
   *
   * End of day, not live. `asOf` is the latest completed session and the build refreshes the
   * following morning, so this is positioning, not a quote feed.
   *
   * **The response carries two separately-ranked boards.** `data.rows` is the covered stock
   * universe and `data.etfRows` is the covered ETF universe. Do not merge them: each row's
   * readings are percentiles of that ticker's own trailing history, so a rank built across
   * both boards compares numbers measured against different baselines. The aggregates are
   * split the same way, with the `etf`-prefixed fields describing the ETF board alone.
   *
   * `data` is `null` before the first nightly build populates it, which is a cold-start
   * state rather than an error.
   *
   * Tiering: a PRO key receives every row. A FREE key receives the top 25 stock rows plus
   * all the aggregates, with `isPreview` true and the envelope's `totalCount` reporting the
   * full stock board; `data.etfTotalCount` does the same for the ETF board.
   *
   * Drill into any row with `client.stocks.getOptionsSummary(ticker)` for its full dossier,
   * or `client.stocks.getOptionsHistory(ticker)` to chart how a reading has trended.
   */
  async getOverview(): Promise<PreviewResponse<OptionsOverview | null>> {
    return this.client.get("/api/v1/options/overview");
  }
}
