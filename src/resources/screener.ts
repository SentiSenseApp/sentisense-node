import type { APIClient } from "../client.js";
import type {
  EtfScreenerExecuteResponse,
  EtfScreenerRow,
  FeaturedScreen,
  ScreenerExecuteOptions,
  ScreenerExecuteResponse,
  ScreenerFieldCatalog,
  ScreenerFieldDescriptor,
  ScreenerFieldOption,
  ScreenerFilter,
  ScreenerPlan,
  ScreenerRow,
  ScreenerScreensResponse,
  ScreenerSort,
} from "../types.js";

/**
 * Screener: filter the tracked universe on the SentiSense Score, attention,
 * analyst consensus, technicals and price in a single query. It is the one
 * surface where our own signals sit in the same `WHERE` clause as the market
 * data, which is the point: screening on analyst ratings alone is something a
 * dozen free tools do, screening on analyst ratings *where the Score disagrees*
 * is not.
 *
 * Every screen is a {@link ScreenerPlan}. Take one from {@link screens} or
 * build your own, then hand it to {@link run} or {@link runEtfs}.
 *
 * Three field semantics are worth knowing before you write a filter, because
 * guessing them wrong produces a screen that looks fine and means nothing:
 *
 * - **`ANALYST_RATING_MEAN` is inverted.** It is the vendor's 1-to-5 scale
 *   where `1.0` is strong buy, so bullish is `LTE 2.5`, not `GTE`. Prefer
 *   `ANALYST_BUY_RATIO_PCT`, which runs the intuitive direction.
 * - **`MA_CROSS_STATE` is ordinal**, not a percentage: `1` golden cross (50-day
 *   above 200-day), `-1` death cross, `0` neither. Use `EQ`.
 * - **`SENTIMENT_DIRECTION` is the sign of the 7-day SentiSense Score**
 *   (`1` / `0` / `-1`) with a neutral band of plus-or-minus 5. Despite the name
 *   it is not sentiment polarity, and `0` matches only an exact zero, so it
 *   returns almost nothing.
 *
 * The Score fields (`SENTI_SCORE_7D`, `SENTI_SCORE_1M`, `SCORE_CHANGE_7D`) are
 * the SentiSense Score, not polarity: unbounded, banded at 5 / 13 / 23 either
 * side of zero. Filter on those band edges, not on values like `0.5`, which
 * behave as "any positive score".
 *
 * Nulls never match, in either direction: `RETURN_1Y >= 0` and `RETURN_1Y < 0`
 * do not partition the universe, because a stock listed four months ago is in
 * neither result. If a screen returns fewer rows than you expect, check
 * coverage before you check your thresholds.
 *
 * Screens read a snapshot that refreshes every 20 minutes, so this is not a
 * quote feed. Use `client.stocks.getQuote()` for live prices.
 */
export class Screener {
  constructor(private client: APIClient) {}

  /**
   * Every filterable field, with its unit, operators and description, for both
   * universes.
   *
   * Build a filter UI from this rather than hardcoding the list and you inherit
   * new fields as they ship. The ETF `STRING` fields (`ISSUER`, `ASSET_CLASS`,
   * `TRACKED_INDEX`) come back with their `values` populated from the live
   * universe, so pickers stay current without a redeploy.
   */
  async fields(): Promise<ScreenerFieldCatalog> {
    return this.client.get("/api/v1/screener/fields");
  }

  /**
   * The curated screens shipped in the product, each with a runnable plan.
   *
   * Each `plan` round-trips straight into {@link run} (or {@link runEtfs} when
   * `plan.universe === "ETF"`) with nothing to rebuild.
   *
   * Their filters identify the field with `field` rather than `fieldName`.
   * Both keys are accepted on the way in, so read either when inspecting a plan
   * you did not build yourself.
   */
  async screens(): Promise<ScreenerScreensResponse> {
    return this.client.get("/api/v1/screener/screens");
  }

  /**
   * Run a screen against the stock universe.
   *
   * `tickers` is optional: omit it to screen the whole tracked universe, pass a
   * list to screen a watchlist. `limit` sits next to the plan rather than
   * inside it, because a plan is a stored object and paging is a transport
   * concern; it defaults to 100 and caps at 500.
   *
   * Read `matched` before you read `results`: it is the count before `limit`
   * was applied, so a `matched` above your `limit` means you are holding the
   * top slice under the plan's sort, not the whole answer.
   *
   * @example
   * ```ts
   * const res = await client.screener.run({
   *   plan: {
   *     filters: [
   *       { fieldName: "SENTI_SCORE_7D", op: "GTE", value: 13 },
   *       { fieldName: "ANALYST_BUY_RATIO_PCT", op: "LTE", value: 30 },
   *       { fieldName: "ANALYST_COUNT", op: "GTE", value: 5 },
   *     ],
   *     sort: { fieldName: "SENTI_SCORE_7D", dir: "DESC" },
   *   },
   *   limit: 25,
   * });
   * ```
   */
  async run(options: ScreenerExecuteOptions): Promise<ScreenerExecuteResponse> {
    return this.client.post("/api/v1/screener/execute", options);
  }

  /**
   * Run a screen against the ETF universe.
   *
   * Same request shape as {@link run}, against a different field vocabulary:
   * take the ETF names from `fields().etf`. `IN` / `NOT_IN` take a `values`
   * array instead of `value` and are the operators for the string fields
   * (`ISSUER`, `ASSET_CLASS`, `TRACKED_INDEX`).
   *
   * `CONSTITUENTS_WEIGHTED_SENTISENSE` is the holdings-weighted SentiSense
   * Score across what the fund owns and is usually the one you want;
   * `DIRECT_SENTISENSE` is the Score from chatter about the fund ticker itself,
   * which on a broad index fund is mostly macro noise. `WEIGHT_COVERED_PCT`
   * tells you how much of the fund's weight had constituent data behind the
   * weighted number.
   */
  async runEtfs(options: ScreenerExecuteOptions): Promise<EtfScreenerExecuteResponse> {
    return this.client.post("/api/v1/screener/etfs/execute", options);
  }
}

// Re-export for convenience so callers can `import type { ScreenerPlan }`
// from the resource module instead of `../types`.
export type {
  EtfScreenerExecuteResponse,
  EtfScreenerRow,
  FeaturedScreen,
  ScreenerExecuteOptions,
  ScreenerExecuteResponse,
  ScreenerFieldCatalog,
  ScreenerFieldDescriptor,
  ScreenerFieldOption,
  ScreenerFilter,
  ScreenerPlan,
  ScreenerRow,
  ScreenerScreensResponse,
  ScreenerSort,
};
