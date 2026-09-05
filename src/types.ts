// ── Client options ──────────────────────────────────────────

export interface SentiSenseOptions {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  /**
   * Extra token appended to the `User-Agent`, after `sentisense-node/{version}`.
   *
   * Use it to say what is calling on top of the SDK, so your traffic is legible in your own
   * logs and in ours: a tool name and version (`"my-bot/1.4"`), and optionally an agent
   * label (`"agent/research-desk"`). Node only, since browsers set the header themselves.
   *
   * Carriage returns and newlines are collapsed to spaces before the header is built, and an
   * empty or whitespace-only value is ignored.
   */
  userAgentSuffix?: string;
}

// ── Stocks ──────────────────────────────────────────────────

export interface StockPrice {
  ticker: string;
  /** Regular-session price, delayed 15 minutes. During RTH: the most recent regular-session value. Otherwise: most recent RTH close. */
  currentPrice: number;
  change: number;
  changePercent: number;
  previousClose: number;
  /** Regular-session volume. */
  volume: number;
  /** Unix timestamp in milliseconds of when this response was served. Not the age of the price: it tracks the current clock regardless of how old the value is. */
  timestamp: number;
  /**
   * Unix timestamp in milliseconds of the market data behind `currentPrice`. Read this for
   * freshness rather than `timestamp`. Absent outside regular hours, and whenever the upstream
   * data carries no time of its own, so treat an absent value as unknown age, not as fresh.
   */
  priceAsOf?: number;
  /** Extended-hours view (pre-market or after-hours). Null/absent during RTH, overnight, and weekends. */
  extendedHours?: ExtendedHoursInfo | null;
  /**
   * Listing lifecycle. Absent for an ordinarily listed stock, which is almost every ticker.
   *
   * `"DELISTED"` means the company no longer trades publicly and EVERY price field above is
   * frozen at the last trade before {@link delistedDate}. It is not a live price, so do not
   * render `changePercent` as a market move.
   *
   * `"PENDING_DELISTING"` means a merger or take-private is scheduled but the stock still
   * trades normally, so the figures above ARE current. Treat it as informational, never as a
   * data-quality warning.
   */
  listingStatus?: 'DELISTED' | 'PENDING_DELISTING';
  /** ISO date (YYYY-MM-DD) trading stopped. Absent unless `listingStatus` is `DELISTED`. */
  delistedDate?: string;
  /** Why it delisted. Absent unless `listingStatus` is `DELISTED`. */
  delistingReason?: 'acquired' | 'take_private' | 'bankruptcy' | 'exchange_rule' | 'merged';
}

/**
 * Extended-hours session view embedded in price / quote responses when the snapshot sees
 * pre-market (04:00–09:30 ET) or after-hours (16:00–20:00 ET) activity. `change` and
 * `changePercent` are computed by the server vs the regular-session `currentPrice`.
 */
export interface ExtendedHoursInfo {
  session: "pre" | "post";
  price: number;
  change: number;
  changePercent: number;
}

/** Aggregate quote snapshot from GET /api/v1/stocks/{ticker}/quote. */
export interface StockQuote {
  ticker: string;
  /** Regular-session price, delayed 15 minutes. During RTH: the most recent regular-session value. Otherwise: most recent RTH close. */
  currentPrice: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  previousClose: number | null;
  week52High: number | null;
  week52Low: number | null;
  marketCap: number | null;
  peRatio: number | null;
  epsTTM: number | null;
  /**
   * Trailing dividend yield as a fraction, not as percentage points: 0.031 is a 3.1% yield.
   * This differs from {@link StockQuote.changePercent}, which is already in percentage points.
   * Null for a stock that pays no dividend.
   */
  dividendYield: number | null;
  /** 200-day simple moving average of daily closes. Null when fewer than 200 trading days of history exist. */
  movingAverage200Day: number | null;
  /**
   * Currency the issuer reports its financials in ("USD", "TWD", "JPY", ...). Absent when
   * the currency is unknown, which is not the same as implicitly USD. Same field and same
   * meaning as {@link Fundamentals.reportedCurrency}.
   *
   * Price fields on this response are always in the listing currency of the quoted symbol,
   * so on an ADR filing in a home currency the price and the per-share statement figures are
   * in different units. The valuation ratios derived from both (`peRatio`, `epsTTM`) are
   * omitted rather than computed in that case, so treat them as possibly absent, not zero.
   */
  reportedCurrency?: string;
  /**
   * Listing lifecycle. Absent for an ordinarily listed stock, which is almost every ticker.
   *
   * `"DELISTED"` means the company no longer trades publicly and EVERY price field above is
   * frozen at the last trade before {@link delistedDate}. It is not a live quote, so do not
   * render `changePercent` as a market move.
   *
   * `"PENDING_DELISTING"` means a merger or take-private is scheduled but the stock still
   * trades and reports normally, so the figures above ARE current. Treat it as informational,
   * never as a data-quality warning.
   */
  listingStatus?: 'DELISTED' | 'PENDING_DELISTING';
  /** ISO date (YYYY-MM-DD) trading stopped. Absent unless `listingStatus` is `DELISTED`. */
  delistedDate?: string;
  /** Why it delisted. Absent unless `listingStatus` is `DELISTED`. */
  delistingReason?: 'acquired' | 'take_private' | 'bankruptcy' | 'exchange_rule' | 'merged';
  /** Unix timestamp in milliseconds of when this response was served. Not the age of the price. */
  timestamp: number | null;
  /**
   * Unix timestamp in milliseconds of the market data behind `currentPrice`. Read this for
   * freshness rather than `timestamp`. Absent outside regular hours, and whenever the upstream
   * data carries no time of its own, so treat an absent value as unknown age, not as fresh.
   */
  priceAsOf?: number;
  /** Extended-hours view (pre-market or after-hours). Null/absent during RTH, overnight, and weekends. */
  extendedHours?: ExtendedHoursInfo | null;
}

export interface StockSocialDominance {
  value: number;
  rank: number;
  percentile: number;
}

/**
 * Stock with company name and entity metadata.
 *
 * The API names the company in two fields: `simpleName` is the short display name
 * ("Agilent") and `companyName` is the legal name ("Agilent Technologies, Inc.").
 */
export interface StockDetail {
  ticker: string;
  /**
   * @deprecated The API never sends this field. It is filled from `simpleName` so
   * older code keeps working; read `simpleName` or `companyName` instead.
   */
  name: string;
  /** Short display name, e.g. "Agilent". */
  simpleName: string;
  /** Legal name, e.g. "Agilent Technologies, Inc.". */
  companyName: string;
  kbEntityId?: string;
  urlSlug?: string;
  /** Brand hex colour. Null for roughly two thirds of the universe. */
  brandColor?: string | null;
  socialDominance?: StockSocialDominance | null;
}

export interface SimilarStock {
  symbol: string;
  name: string;
  /** @deprecated No longer returned by the API; use `symbol` to identify the peer. Will be removed in a future release. */
  kbEntityId?: string;
  price: number | null;
  changePercent: number | null;
}

export interface StockImage {
  iconUrl: string | null;
  logoUrl: string | null;
}

export interface StockProfile {
  ticker: string;
  name: string;
  ceo?: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  description?: string;
  /**
   * Listing lifecycle. Absent for an ordinarily listed stock. See {@link StockPrice.listingStatus}
   * for what `"DELISTED"` and `"PENDING_DELISTING"` mean for the rest of the payload.
   */
  listingStatus?: 'DELISTED' | 'PENDING_DELISTING';
  /** ISO date (YYYY-MM-DD) trading stopped. Absent unless `listingStatus` is `DELISTED`. */
  delistedDate?: string;
  /** Why it delisted. Absent unless `listingStatus` is `DELISTED`. */
  delistingReason?: 'acquired' | 'take_private' | 'bankruptcy' | 'exchange_rule' | 'merged';
  /**
   * For a tracked ETF ticker, the curated landscape card image for the fund: the
   * same value returned by {@link EtfInfo.imageUrl}. Separate from `logoUrl` and
   * `iconUrl`, which are square branding marks. Absent when no curated image is
   * assigned, and for ordinary stocks.
   */
  imageUrl?: string | null;
  [key: string]: unknown;
}

export interface StockEntity {
  entityId: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

/** Per-source tone for a stock: where the conversation is, and how it leans. */
export interface SentimentSourceTone {
  /** "News", "Reddit", "X", "YouTube", "Substack". */
  source: string;
  /** "Bullish" | "Neutral" | "Bearish". */
  direction: string;
  /**
   * Whole-number percent of this stock's mentions, not a fraction. Each source's share is
   * rounded independently, so the array sums to about 100 rather than exactly 100: 101 is
   * common and is not a data error. Do not use the shares to reconstruct per-source counts.
   */
  mentionShare: number;
  /** Exact polarity in [-1, 1]. */
  value?: number;
}

/** A news story moving a stock's sentiment, with its own tone. */
export interface SentimentDriver {
  title: string;
  /** Tone of this driver in [-1, 1]. */
  tone: number;
}

export interface StockSentiment {
  ticker: string;
  companyName?: string;
  /** ISO date (YYYY-MM-DD) the data is current as of. */
  asOf?: string;
  /** Latest SentiSense Score: a 0-centered composite of sentiment and mentions, unbounded. */
  sentisenseScore?: number;
  /** 30-day average Score, the stable regime figure. */
  sentisenseScoreAvg30d?: number;
  sentisenseScoreDelta30d?: number;
  /** Seven-band label of the 30-day average. */
  scoreLabel?: string;
  /** "Bullish" | "Neutral" | "Bearish", from the 30-day average. */
  direction?: string;
  /** Same three bands, from today's read. */
  latestDirection?: string;
  /** "UP" | "DOWN" | "FLAT". */
  trend?: string;
  /** Daily Score series. */
  scoreSparkline?: number[];
  /** Today's mention volume. */
  mentions?: number;
  /** 30-day average mentions per day. */
  mentionsAvg30d?: number;
  /** Latest share of voice, as a fraction (0.021 = 2.1%). Note this is NOT the same unit as `mentionShare`. */
  socialDominance?: number;
  /** Per-source tone, loudest source first. */
  bySource?: SentimentSourceTone[];
  relatedTickers?: Array<{ ticker: string; name: string }>;
  drivers?: SentimentDriver[];
  /** Plain-language summary of why the Score sits where it does. */
  narrative?: string;
  faq?: Array<{ question: string; answer: string }>;
  [key: string]: unknown;
}

export interface ChartDataPoint {
  /** Unix timestamp in milliseconds. */
  timestamp?: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /**
   * US-equity market session: "pre" (04:00–09:30 ET), "regular" (09:30–16:00 ET),
   * or "post" (16:00–20:00 ET). Populated for intraday timeframes (1D / 5D / 1W / 1M);
   * `null` for daily / weekly bars (3M and longer) that span whole sessions.
   */
  session?: "pre" | "regular" | "post" | null;
}

export interface ChartData {
  ticker: string;
  timeframe: string;
  data: ChartDataPoint[];
}

export interface MarketStatus {
  status: string;
  [key: string]: unknown;
}

/**
 * One period of filed financial statement data from `stocks.getFundamentals()`.
 *
 * The index signature is deliberate: the response carries the full income statement, balance
 * sheet, and cash flow line items, and more are added over time, so every field is reachable
 * whether or not it is typed here. The cash-flow block below is typed because its sign and
 * relationships are easy to get wrong.
 */
export interface Fundamentals {
  ticker: string;
  timeframe: string;
  /**
   * The currency the filer reports in ("USD", "KRW", "EUR", ...). Statement figures are as
   * reported in this currency and are never converted to US dollars: foreign companies listed
   * as ADRs file in their home currency while their listed share price is in USD. Absent means
   * the currency is unknown, not implicitly USD. For non-USD filers the API serves `peRatio`,
   * `psRatio`, and `pbRatio` as `null` on purpose (a USD price over a home-currency per-share
   * figure is a unit mismatch); do not recompute them client-side.
   */
  reportedCurrency?: string;
  /** Net cash from operating activities, in the reporting currency (see `reportedCurrency`). */
  operatingCashFlow?: number | null;
  /** Net cash from investing activities, in the reporting currency. */
  investingCashFlow?: number | null;
  /** Net cash from financing activities, in the reporting currency. */
  financingCashFlow?: number | null;
  /**
   * Capital expenditure, in the reporting currency, signed as filed: normally NEGATIVE,
   * because it is an outflow. Take the absolute value before treating it as a magnitude.
   */
  capitalExpenditure?: number | null;
  /**
   * Free cash flow, in the reporting currency: `operatingCashFlow - Math.abs(capitalExpenditure)`.
   *
   * `null` rather than a guess when the period's capital expenditure is not available, so a
   * screen for positive free cash flow can never match on a fabricated number. Do not
   * substitute `operatingCashFlow + investingCashFlow`: investing cash flow also carries
   * marketable-securities and acquisition activity, which for a company holding a large
   * securities portfolio is wrong by billions and can flip the sign.
   */
  freeCashFlow?: number | null;
  [key: string]: unknown;
}

/**
 * Trailing-twelve-month snapshot from `stocks.getCurrentFundamentals()`: TTM ratios,
 * a different shape from the per-period statement data in {@link Fundamentals}.
 */
export interface TtmFundamentals {
  ticker: string;
  currentPrice?: number;
  peTTM?: number | null;
  psTTM?: number | null;
  epsTTM?: number | null;
  revenueTTM?: number | null;
  quartersIncluded?: number;
  /** False when there is not enough filed history to compute the TTM figures. */
  available?: boolean;
  /** Populated when `available` is false, explaining why. */
  reason?: string | null;
  [key: string]: unknown;
}

export interface FundamentalsPeriod {
  fiscalPeriod: string;
  fiscalYear: number;
}

/**
 * What `stocks.getFundamentalsPeriods()` returns: the periods are in `periods`, not at
 * the top level.
 */
export interface FundamentalsPeriodsResponse {
  ticker: string;
  periods: FundamentalsPeriod[];
  /** Populated when no periods are available, explaining why. */
  reason?: string | null;
}

export interface ShortInterest {
  ticker: string;
  [key: string]: unknown;
}

export interface FloatInfo {
  ticker: string;
  [key: string]: unknown;
}

export interface ShortVolume {
  ticker: string;
  [key: string]: unknown;
}

export interface MetricsBreakdown {
  [key: string]: unknown;
}

export interface AISummary {
  ticker: string;
  [key: string]: unknown;
}

// ── Stocks method options ───────────────────────────────────

export interface GetChartOptions {
  /**
   * Chart range. "MAX" returns the full available history (up to ~26 years) as monthly bars;
   * "10Y" and "5Y" return weekly bars.
   *
   * Price basis differs by range, so do not compare closes across two ranges without
   * checking this: "10Y" and "MAX" are split- and dividend-adjusted, while "5Y" and every
   * shorter range are split-adjusted only. A "5Y" weekly close equals the "1Y" daily close of
   * that week's last trading day; the "10Y" bar for the same week is lower by the dividends
   * paid since, and the gap widens the further back you read.
   *
   * "ALL" is a legacy alias of "5Y", retained so existing code keeps compiling.
   */
  timeframe?: "1D" | "5D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y" | "10Y" | "MAX" | "ALL";
}

export interface GetImagesOptions {
  forced?: boolean;
}

export interface GetDescriptionsOptions {
  forced?: boolean;
}

export interface GetSimilarOptions {
  limit?: number;
}

export interface GetProfileOptions {
  forced?: boolean;
}

export interface GetAISummaryOptions {
  depth?: "basic" | "deep";
  /**
   * @deprecated Has no effect and is no longer sent. Reports are curated and served
   * as published, so there is nothing for a caller to regenerate on demand. Accepted
   * only so existing code keeps compiling; drop it from your call.
   */
  forceRefresh?: boolean;
}

export interface GetMetricsBreakdownOptions {
  startTime?: number;
  endTime?: number;
}

export interface GetFundamentalsOptions {
  timeframe?: "quarterly" | "annual";
  fiscalPeriod?: string;
  fiscalYear?: number;
}

// ── Options Intelligence ────────────────────────────────────

/**
 * One session's aggregate options activity for a ticker.
 *
 * Every field is optional because the response omits anything it cannot compute rather than
 * sending a null, so check for presence rather than comparing against `null`. Ratio and
 * implied-volatility fields drop out first: `pcVol` is absent when call volume is zero.
 */
export interface OptionsAggregate {
  /** Session date, ISO calendar day `"YYYY-MM-DD"`. */
  date?: string;
  callVol?: number;
  putVol?: number;
  callOi?: number;
  putOi?: number;
  /** Put/call volume ratio. */
  pcVol?: number;
  /** Put/call open-interest ratio. */
  pcOi?: number;
  /** Volume-weighted implied volatility. */
  vwIv?: number;
  /** At-the-money implied volatility. */
  atmIv?: number;
  /** `iv25p - iv25c`: positive means puts are bid up relative to calls. */
  skew25d?: number;
  /** Roughly 60-day and 90-day at-the-money implied volatility: the term structure. */
  atmIv60?: number;
  atmIv90?: number;
  /** Raw 25-delta call and put implied volatilities. */
  iv25c?: number;
  iv25p?: number;
  /**
   * Calibrated 90% expected move over 1 trading session, as a fraction of price, so `0.0407`
   * is 4.07%. `k * atmIv * Math.sqrt(h / 252)` with an empirical `k` (1.48 here) fit on
   * SentiSense's own stored option history. The 90% is a measured historical coverage rate,
   * not a guarantee, and the range carries no direction and no price target.
   */
  expectedMove1d?: number;
  /** The same calibrated 90% range over 5 trading sessions (`k` = 1.56). */
  expectedMove5d?: number;
  /** The same calibrated 90% range over 20 trading sessions (`k` = 1.56). */
  expectedMove20d?: number;
  /**
   * One-sigma expected move over 1 trading session, `atmIv * Math.sqrt(h / 252)`: the industry
   * convention, roughly 68% of moves, with no calibration applied.
   */
  expectedMove1s1d?: number;
  /** One-sigma expected move over 5 trading sessions. */
  expectedMove1s5d?: number;
  /** One-sigma expected move over 20 trading sessions. */
  expectedMove1s20d?: number;
  netDelta?: number;
  notionalVol?: number;
  contracts?: number;
}

/**
 * Percentile context for {@link OptionsAggregate}, against that ticker's own trailing
 * history rather than against other tickers.
 *
 * A percentile whose window holds too few observations is omitted while the baseline builds,
 * which is why a covered ticker can answer with readings and no percentiles.
 */
export interface OptionsContext {
  pcVolPctl1y?: number;
  pcVolPctl5y?: number;
  pcOiPctl1y?: number;
  /** Where today's at-the-money implied volatility sits in its own trailing year. */
  ivRank1y?: number;
  skewPctl1y?: number;
  observations1y?: number;
}

/** One open-interest concentration at a strike. */
export interface OptionsWall {
  strike?: number;
  oi?: number;
}

/** Open-interest wall structure for the dossier's expiry, up to three walls a side. */
export interface OptionsOiWalls {
  expiry?: string;
  maxPain?: number;
  callWalls?: OptionsWall[];
  putWalls?: OptionsWall[];
}

/** A contract whose session volume far exceeds its open interest: fresh positioning. */
export interface OptionsUnusualContract {
  /** Exchange-style option symbol, e.g. `"NVDA260821C00200000"`. */
  contract?: string;
  /** Side of the contract. Arrives lower case (`"call"` / `"put"`), so compare case-insensitively. */
  type?: string;
  strike?: number;
  expiry?: string;
  /** Days to expiry. */
  dte?: number;
  volume?: number;
  oi?: number;
  volOiRatio?: number;
  premium?: number;
}

/**
 * The options dossier for one stock or ETF, from `client.stocks.getOptionsSummary()`.
 *
 * End of day, not live: it describes the latest completed session and refreshes the
 * following morning.
 */
export interface OptionsSummary {
  /** Session the dossier describes, ISO calendar day. */
  asOf?: string;
  /**
   * Positioning lean for the session, roughly -1 to 1, negative for put-heavy.
   *
   * A number on the wire, not a label. Sampled across several tickers to confirm that,
   * because the field name reads like it could carry a word.
   */
  sentiment?: number;
  /** Today's aggregate. */
  latest?: OptionsAggregate;
  /** Percentiles of `latest` against this ticker's own history. */
  context?: OptionsContext;
  oiWalls?: OptionsOiWalls;
  /** Top contracts by premium. */
  unusual?: OptionsUnusualContract[];
}

/** Trailing window for `client.stocks.getOptionsHistory()`. */
export type OptionsHistoryWindow = "1y" | "2y" | "5y";

export interface GetOptionsHistoryOptions {
  /**
   * Trailing window. Omitted, the API applies its own default of `"1y"`, and any
   * unrecognised value clamps to `"1y"` rather than erroring.
   *
   * `"5y"` means "everything stored", which is currently a little over two years, so
   * `"5y"` and `"2y"` can answer with nearly the same series. Read the window actually
   * served off `OptionsHistory.window` rather than assuming you got what you asked for:
   * a FREE key always receives `"1y"` whatever it requests.
   */
  window?: OptionsHistoryWindow;
}

/**
 * The daily-aggregate time series for one stock or ETF, from
 * `client.stocks.getOptionsHistory()`.
 *
 * **Unlike `getOptionsSummary`, this never answers with a null payload.** A ticker
 * outside the covered universe, an unknown symbol, and a covered ticker with nothing
 * stored yet all return this object with an empty `series`, so read the array's length
 * rather than null-checking the payload.
 */
export interface OptionsHistory {
  ticker?: string;
  /**
   * Window the server actually served, which is not always the one you asked for: an
   * unrecognised request clamps to `"1y"`, and so does any request on a FREE key.
   */
  window?: string;
  /** Ascending by date, oldest first. Same shape as the dossier's `latest` aggregate. */
  series?: OptionsAggregate[];
}

/**
 * One ticker's row on the market-wide options radar, from `client.options.getOverview()`.
 *
 * Every percentile here is against **that ticker's own trailing history**, never against
 * the rest of the board, so a row's `ivRank1y` says this name's implied volatility is high
 * for itself and says nothing about whether it is high next to another name's.
 *
 * A covered ticker whose baseline is still building (roughly 60 sessions, plus a liquidity
 * floor) carries its raw readings with the percentiles and `interestScore` omitted, so
 * absent scores mean "not enough history yet", not "nothing interesting".
 */
export interface OptionsOverviewRow {
  ticker?: string;
  /** Company name, or the fund name on an ETF row. Absent when unmapped. */
  name?: string;
  /**
   * Sector on a stock row. On an **ETF row this carries the fund's asset class**
   * (`"Equity"`, `"Bond"`, `"Commodity"`, ...) rather than a sector, so do not feed the two
   * boards' values into one sector breakdown.
   */
  sector?: string;
  /** Session this row describes, ISO calendar day. */
  asOf?: string;
  /** Options-implied positioning lean, roughly -1 to 1, negative for put-heavy. */
  sentiment?: number;
  /** Composite 0-100 blend of how extreme this row's readings are. Omitted while the baseline builds. */
  interestScore?: number;
  /** Put/call volume ratio for the session. */
  pcVol?: number;
  /** Percentile (0-100) of `pcVol` within this ticker's own trailing year. */
  pcVolPctl1y?: number;
  /** At-the-money implied volatility as a fraction, so `0.42` is 42%. */
  atmIv?: number;
  /** Where `atmIv` sits in this ticker's own trailing-year range, 0-100. */
  ivRank1y?: number;
  /** `iv25p - iv25c`, on the same scale as the IVs: `0.03` is three IV points. */
  skew25d?: number;
  /** Percentile (0-100) of `skew25d` within this ticker's own trailing year. */
  skewPctl1y?: number;
  /** Premium traded this session: volume times mark times 100. */
  notionalVol?: number;
  /** Signed change of `atmIv` against its ~20-session mean. Rank "biggest IV moves" by absolute value. */
  ivMove20?: number;
  /** Calibrated 90% expected move over 1 trading session, as a fraction of price. */
  expectedMove1d?: number;
  /** The same calibrated 90% range over 5 trading sessions. */
  expectedMove5d?: number;
  /** The same calibrated 90% range over 20 trading sessions. */
  expectedMove20d?: number;
  /** One-sigma expected move over 1 trading session: the industry convention, uncalibrated. */
  expectedMove1s1d?: number;
  /** One-sigma expected move over 5 trading sessions. */
  expectedMove1s5d?: number;
  /** One-sigma expected move over 20 trading sessions. */
  expectedMove1s20d?: number;
  /** Trailing-1y observation count, which is what drives the building-baseline state. */
  observations1y?: number;
  /** Unusually-active contracts this session. */
  unusualCount?: number;
  /** Largest volume/open-interest multiple among them. Absent when `unusualCount` is 0. */
  maxVolOiRatio?: number;
  /** Largest premium among them. Absent when `unusualCount` is 0. */
  maxUnusualPremium?: number;
  /** Side of the single heaviest open-interest wall, `"call"` or `"put"`. */
  wallSide?: string;
  /** Strike of that wall. */
  wallStrike?: number;
  /** That wall's share of its own side's open interest, 0 to 1. */
  wallShare?: number;
}

/**
 * The market-wide options radar, from `client.options.getOverview()`.
 *
 * **Two separately-ranked boards, never one.** `rows` is the covered stock universe and
 * `etfRows` is the covered ETF universe, each already sorted by `interestScore` descending
 * with unscored building-baseline rows last. Concatenating them produces a ranking that
 * means nothing, because every reading behind the score is a percentile of that ticker's
 * own past: an ETF's 90th percentile and a single stock's 90th percentile are measured
 * against different histories.
 *
 * The aggregates split the same way. `medianIvRank`, `marketPcVol`, `extremeCount` and
 * `coverageCount` describe the stock board only; the four `etf`-prefixed fields describe
 * the ETF board and are omitted entirely when a build has no ETF rows.
 *
 * End of day, not live: `asOf` is the latest completed session.
 */
export interface OptionsOverview {
  /** Session the build describes, ISO calendar day. */
  asOf?: string;
  /** Median `ivRank1y` across the stock board. */
  medianIvRank?: number;
  /** Median put/call volume ratio across the stock board. */
  marketPcVol?: number;
  /** Stock rows reading as extreme today, out of `coverageCount`. */
  extremeCount?: number;
  /** Full size of the stock board, which stays the full number even on a truncated FREE response. */
  coverageCount?: number;
  /** The stock board, ranked. FREE keys receive the top 25; the envelope's `totalCount` carries the full size. */
  rows?: OptionsOverviewRow[];
  /** The ETF board, ranked independently. Omitted entirely when a build has no ETF rows. */
  etfRows?: OptionsOverviewRow[];
  /** Median `ivRank1y` across the ETF board. */
  etfMedianIvRank?: number;
  /** Median put/call volume ratio across the ETF board. */
  etfMarketPcVol?: number;
  /** ETF rows reading as extreme today, out of `etfCoverageCount`. */
  etfExtremeCount?: number;
  /** Full size of the ETF board, which stays the full number even on a truncated FREE response. */
  etfCoverageCount?: number;
  /** Full ETF board size on a FREE response, mirroring what the envelope's `totalCount` does for stocks. */
  etfTotalCount?: number;
}

// ── SentiSense Rating ───────────────────────────────────────
//
// The SentiSense Rating is an informational, relative rank: it places a stock against the
// other stocks rated on the same day, across six dimensions. It is a research signal, not a
// recommendation, and it carries no directive meaning about any security. Methodology:
// https://sentisense.ai/methodology/#sentisense-rating

/** The six dimensions the composite is blended from, by stable `key`. */
export type RatingDimensionKey =
  | "crowd"
  | "smart_money"
  | "options"
  | "analysts"
  | "fundamentals"
  | "earnings";

/**
 * Why a stock has no grade.
 *
 * `stale` means a row exists but the nightly has not written recently, which is an
 * operational gap rather than a coverage one. `not_rated_today` means no row and no refusal
 * on record: an ETF, a ticker outside the swept universe, or one that entered coverage after
 * the last run. The other two mean the run looked and declined to grade.
 */
export type RatingNotRatedReason =
  | "stale"
  | "not_rated_today"
  | "insufficient_dimensions"
  | "insufficient_coverage_weight";

/**
 * A risk condition evaluated against a rated stock. An active one deducts points from the
 * score, up to 12 apiece; `percentile` itself is never touched by them.
 */
export type RiskCondition =
  | "thin_coverage"
  | "weak_dimension"
  | "unprofitable"
  | "no_fundamentals"
  | "high_leverage"
  | "unseasoned_listing"
  | "small_market_cap"
  | "thin_liquidity"
  | "extended_price"
  | "insider_selling"
  | "institutional_outflow";

/**
 * One graded deduction applied to a rated stock's score.
 *
 * A condition is graded rather than binary, so `points` is the share of the 12-point
 * maximum this one actually cost. Only active conditions appear, and `penaltyPoints` is
 * the sum of these.
 */
export interface RiskAdjustment {
  /** Which condition, by the same key `riskConditions` reports. */
  condition: RiskCondition;
  /** Points deducted, to one decimal, up to 12 for a single condition. */
  points: number;
}

/**
 * One constituent leg behind a dimension's percentile.
 *
 * Only the smart-money dimension carries legs today; every other dimension omits the field
 * entirely, so an absent `subLegs` means "this dimension has no legs", never "the legs were
 * all zero".
 */
export interface RatingSubLeg {
  /** Stable snake_case identifier, e.g. `"inst_13f"`. */
  key: string;
  label: string;
  /** The leg's natural-scale reading. `null` when the leg had no data. */
  raw: number | null;
  /** `"%"` for a percentage, `"ratio"` for a scale-free balance. */
  unit: string;
}

/**
 * One of the six dimensions the composite is blended from.
 *
 * **All six always arrive, in a fixed order, whether or not they had data.** An absent
 * dimension is a full row with `present` false and a `null` percentile; the server never
 * drops it, precisely so a client cannot mistake a gap for a five-dimension rating. Read
 * `present` before reading `percentile`, and never substitute zero for a `null`: zero is the
 * bottom of the cross-section, absence is not a position on it.
 */
export interface RatingDimension {
  key: RatingDimensionKey;
  /** Display label, owned by the API so every surface agrees on the wording. */
  label: string;
  /** The dimension's cross-sectional rank, 0 to 100. `null` when absent. */
  percentile: number | null;
  /** The natural-scale reading behind the percentile, when the dimension has one. */
  raw: number | null;
  /** What `raw` means and in what unit, e.g. `"Operating margin, percent"`. */
  rawLabel: string | null;
  /** Whether this dimension had data for this stock. */
  present: boolean;
  /** Constituent legs, currently smart-money only. Absent on every other dimension. */
  subLegs?: RatingSubLeg[];
}

/**
 * One anomaly flag evaluated alongside the rating.
 *
 * Flags are informational and never move the composite. A flag the run could not evaluate is
 * absent from the list rather than reported inactive, so present-and-false and absent stay
 * distinguishable.
 */
export interface RatingFlag {
  /** Stable snake_case identifier, e.g. `"unusual_options_flow"`. */
  key: string;
  label: string;
  active: boolean;
}

/** The fields both rating shapes carry, graded or not. */
export interface RatingBase {
  ticker: string;
  /**
   * The stock's knowledge base id, e.g. `"kb/company/1"`. Addresses the metrics time series
   * without a second lookup.
   */
  kbEntityId: string;
  /** The New York calendar day this answer describes, `"YYYY-MM-DD"`. */
  asOf: string;
  /** Always all six, in a fixed order, absent ones with `present` false. */
  dimensions: RatingDimension[];
  flags: RatingFlag[];
  /** The standard financial disclaimer. Display it alongside the grade. */
  disclaimer: string;
}

/**
 * A stock that has a grade for `asOf`.
 *
 * `score`, `bucketLetter`, `riskConditions`, `riskAdjustments` and `penaltyPoints` arrive
 * from the next API deploy onward and are optional here because a response served before
 * then omits them.
 */
export interface StockRating extends RatingBase {
  rated: true;
  /**
   * The headline number, 0 to 100 with one decimal, and the number `letter` is the band
   * of: `score = percentile - sum(riskAdjustments.map((a) => a.points))`, floored at 10
   * when fewer than five dimensions are available and at 0 otherwise. Absent on a
   * response served before this field shipped.
   */
  score?: number;
  /**
   * `"A"`, `"B"`, `"C"`, `"D"` or `"F"`: the band `score` falls in, at edges 90, 70, 30
   * and 10. Served as stored, so read it rather than deriving your own edges. Deriving
   * it from `percentile` disagrees with the API for every stock carrying a risk
   * condition.
   */
  letter: string;
  /**
   * The band `percentile` alone would fall in, so a difference from `letter` is exactly
   * what the risk conditions cost. Absent on a response served before this field
   * shipped.
   */
  bucketLetter?: string;
  /**
   * Rank of `composite` among the day's rated stocks, 0 to 100. This stays the true rank
   * of the blended signals: the risk conditions are subtracted from `score`, never here.
   */
  percentile: number;
  /** The weighted blend before ranking, in [-1, +1]. */
  composite: number;
  /**
   * Which risk conditions were active. An empty array means none were, and the field is
   * absent on a response served before it shipped.
   */
  riskConditions?: RiskCondition[];
  /**
   * The same conditions with the points each one actually cost, since a condition is
   * graded rather than binary and can cost anything up to 12. Absent on a response
   * served before this field shipped.
   */
  riskAdjustments?: RiskAdjustment[];
  /**
   * The sum of `riskAdjustments` points, to one decimal: how far `score` sits below
   * `percentile` before the floor applies. Absent on a response served before this field
   * shipped.
   */
  penaltyPoints?: number;
  /** How many stocks were rated that day: the rank's denominator. */
  ratedCount: number;
  /** The weights and floors in force when the row was written, e.g. `"2026.09-v1"`. */
  methodologyVersion: string;
}

/**
 * A stock with no grade for `asOf`. A normal 200, not an error: ETFs and tickers outside
 * the swept universe answer this way, and the composition still arrives so a card can render.
 */
export interface StockNotRated extends RatingBase {
  rated: false;
  /** Why there is no grade. */
  reason: RatingNotRatedReason;
  /** How many of the six dimensions had data. */
  dimensionsPresent?: number;
  /** Which dimensions had data, by `key`. */
  presentDimensions: RatingDimensionKey[];
}

/**
 * The SentiSense Rating for one stock: where it ranks against the day's rated set.
 *
 * A discriminated union on `rated`, so `if (rating.rated)` narrows to the graded fields and
 * the `else` branch narrows to `reason`. Branch on that flag rather than testing a field for
 * `undefined`.
 *
 * The rating is a *relative* research signal, informational and educational only. It ranks a
 * stock against the others rated that day; it is not financial, investment or trading advice
 * and it is not a recommendation about any security. Carry `disclaimer` wherever you display
 * a grade. Methodology: https://sentisense.ai/methodology/#sentisense-rating
 */
export type StockRatingResponse = StockRating | StockNotRated;

// ── Documents & News ────────────────────────────────────────

export type DocumentSource = "news" | "reddit" | "x" | "substack" | "youtube";

/** Per-entity sentiment classification with resolved entity details. */
export interface SentimentEntry {
  ticker: string | null;
  name: string | null;
  entityId: string;
  entityType: string;
  sentiment: string;
}

/** Document object with sentiment metrics and metadata. */
export interface Document {
  id: string;
  url: string;
  source: "NEWS" | "REDDIT" | "X" | "SUBSTACK" | "YOUTUBE";
  /**
   * Publisher name for a news article, e.g. `"The Motley Fool"`. Null on social sources,
   * where the publisher is the platform already named in `source`, so fall back to
   * `source` for a label rather than printing an empty string.
   *
   * Typed optional so existing object literals keep compiling; the API sends the key on
   * every document row.
   */
  sourceName?: string | null;
  published: number;
  averageSentiment: number;
  reliability: number;
  sentiment: SentimentEntry[];
}

/**
 * What the document-metrics endpoints return: `documents.getByTicker()`,
 * `getByTickerRange()`, `getByEntity()`, `search()` and `getBySource()` all resolve to
 * this. The rows are in `documents`, and this is NOT the {@link PreviewResponse}
 * envelope: there is no `isPreview` or `data`.
 */
export interface DocumentSearchResponse {
  documents: Document[];
  /** Total matching documents before any limit was applied. */
  totalCount: number;
  /** Ticker the query resolved to, or `null` when the query was not ticker-scoped. */
  searchTicker: string | null;
  /** Source filter applied, or `"ALL"` when unfiltered. */
  source: string;
  startDate: string;
  endDate: string;
}

/** Story cluster with title, sentiment, and metrics. */
export interface StoryCluster {
  id: string;
  title: string;
  clusterSize: number;
  averageSentiment: number;
  /** Unix timestamp in seconds when the cluster was assembled by our pipeline. */
  clusteredAt: number;
  /**
   * How the story was authored: `"ORIGINAL"` for an editorially authored SentiSense
   * Original, `"AI"` for a pipeline-generated story. Optional because an older API
   * build omits it, in which case it is `undefined` rather than `"AI"`.
   */
  storySource?: "ORIGINAL" | "AI";
  /**
   * True while the story is still being revised as the event develops. Optional
   * because an older API build omits it, in which case it is `undefined` rather than
   * `false`: read that as "not known", not as "settled".
   */
  isLive?: boolean;
}

/**
 * One dated update on a live story, as served inside the story detail response's
 * `timeline` array (newest first, empty when a story has none).
 *
 * `documents.getStoryDetail()` returns `unknown`, so this type is exported for callers
 * that narrow the response themselves.
 */
export interface StoryTimelineEntry {
  /** Publication time of this update, Unix milliseconds. */
  publishedAt: number;
  /**
   * `"INITIAL"`, `"UPDATE"` or `"CORRECTION"`. Left open: an unrecognised label is
   * served through rather than rejected, so branch on the three known values and let
   * anything else fall through to a neutral rendering.
   */
  updateType: "INITIAL" | "UPDATE" | "CORRECTION" | (string & {});
  /** The update text, markdown. */
  content: string;
}

export interface Story {
  cluster: StoryCluster;
  /** Human-formatted labels for display, e.g. `"Apple Inc (AAPL)"`. For display only; do not parse symbols out of these. Use `tickers` programmatically. */
  displayTickers: string[];
  /** Bare ticker symbols for programmatic use, e.g. `"AAPL"`. Use these to filter or look up stocks. */
  tickers: string[];
  primaryEntityNames: string[];
  impactScore: number;
  /** Unix timestamp in seconds when the story first broke. Null when the story has no representative document timestamp yet. */
  brokeAt: number | null;
}

// ── Documents method options ────────────────────────────────

export interface GetByTickerOptions {
  source?: DocumentSource;
  days?: number;
  hours?: number;
  limit?: number;
}

export interface GetByTickerRangeOptions {
  startDate: string;
  endDate: string;
  source?: DocumentSource;
  limit?: number;
}

export interface GetByEntityOptions {
  source?: DocumentSource;
  days?: number;
  hours?: number;
  limit?: number;
}

export interface SearchDocumentsOptions {
  source?: DocumentSource;
  days?: number;
  limit?: number;
}

export interface GetBySourceOptions {
  days?: number;
  hours?: number;
  limit?: number;
  /**
   * Result ordering. `latest` (default) returns newest first. `top` returns a
   * reliability-first ranking that surfaces recent content from high-authority
   * publishers ahead of low-authority floods.
   */
  sort?: "latest" | "top";
}

export interface GetStoriesOptions {
  limit?: number;
  /**
   * Accepted by the endpoint but ignored, so it does not narrow the window. Use
   * `filterHours` for the look-back, and pass `days * 24` if you are thinking in days.
   */
  days?: number;
  offset?: number;
  /** Look-back window in hours, for example 48 for the last two days. */
  filterHours?: number;
}

export interface GetStoriesByTickerOptions {
  limit?: number;
}

// ── Institutional Flows ─────────────────────────────────────

export interface Quarter {
  value: string;
  label: string;
  reportDate: string;
  /**
   * True while this quarter's 13F filing window is still open, which is the 45 days after
   * quarter end.
   *
   * Read it before you pick a quarter to query. The list leads with the current quarter, so
   * the newest entry is pending for six weeks of every quarter, and a holders request against
   * a pending quarter answers `200` with few rows or none: correct server behaviour, and
   * indistinguishable from "this stock has no institutional owners" unless you checked here
   * first. For a complete picture take the newest quarter with `pending` false.
   *
   * Typed optional so existing object literals keep compiling; the API sends the key on
   * every row.
   */
  pending?: boolean;
}

export interface InstitutionalFlow {
  ticker: string;
  companyName: string;
  totalSharesBought: number;
  totalSharesSold: number;
  netSharesChange: number;
  newPositions: number;
  increasedPositions: number;
  decreasedPositions: number;
  soldOutPositions: number;
  indexFundNetChange: number;
  hedgeFundNetChange: number;
  /** Net share change contributed by each remaining filer category this quarter. */
  activistNetChange: number;
  pensionNetChange: number;
  bankNetChange: number;
  insuranceNetChange: number;
  mutualFundNetChange: number;
  sovereignWealthNetChange: number;
  endowmentNetChange: number;
  conglomerateNetChange: number;
  activistActivity: boolean;
  reportDate: string;
  /**
   * Quarterly average closing price used to weight the dollar flow.
   * Null when no price is cached for this (quarter, ticker) yet.
   */
  avgClosePrice?: number | null;
  /**
   * Dollar-weighted net flow: `netSharesChange × avgClosePrice`. 0 when
   * `avgClosePrice` is missing, so fall back to displaying `netSharesChange`.
   */
  dollarFlowUsd: number;
}

export interface Holder {
  filerCik: string;
  filerName: string;
  filerCategory: string;
  shares: number;
  valueUsd: number;
  changeType: "NEW" | "INCREASED" | "DECREASED" | "SOLD_OUT" | "UNCHANGED";
  sharesChange: number;
  sharesChangePct: number;
  /**
   * URL slug for this filer, to pass straight to
   * `institutional.getInstitutionDetail()`. Null when the filer has no curated
   * institution page, so check it before building a link.
   *
   * Typed optional so existing object literals keep compiling; the API sends the key
   * on every holder row.
   */
  entitySlug?: string | null;
  /**
   * Number of SEC filer CIKs rolled up into this row, when the row aggregates a
   * multi-filer manager. Null for a single-CIK filer, which is the common case, so
   * read it as "1 or unknown" rather than zero.
   */
  cikCount?: number | null;
}

/**
 * A server-side shortlist of the quarter's significant position changes, so a caller
 * paging through thousands of rows does not have to fetch them all to find the movers.
 *
 * Scoped to the whole ticker, not to the page you asked for: the same values come back
 * whatever `limit` and `offset` you send. The server picks both the threshold behind
 * `count` and the ranking behind `top`, and neither is part of the API contract, so treat
 * this as a display aid and re-derive anything you need to sort or filter on from `holders`.
 */
export interface HolderNotableChanges {
  /** How many holders the server judged to have changed significantly this quarter. */
  count: number;
  /** The shortlist itself, already ranked. Same row shape as `holders`. */
  top: Holder[];
}

/**
 * Institutional ownership for one ticker: the `data` payload of
 * `institutional.getHolders()`, which returns `PreviewResponse<TickerHolders>`. The
 * holder rows are in `holders`, so read them as `result.data.holders` (two levels down),
 * alongside ticker-level totals like `holderCount`.
 */
export interface TickerHolders {
  ticker: string;
  companyName: string;
  reportDate: string;
  totalInstitutionalShares: number;
  totalInstitutionalValue: number;
  /** Every institutional holder of this ticker for the quarter, ignoring any paging. */
  holderCount: number;
  holders: Holder[];
  /**
   * Rows actually returned in `holders`. Sent only when you passed `limit`, so use
   * `holders.length` if you need a count that is always there. On the last page it is
   * smaller than the `limit` you asked for, which is how you know to stop.
   */
  returnedCount?: number;
  /**
   * Row offset these `holders` start at, echoing the request. Sent only when you passed
   * `limit`; the unpaged response omits it rather than sending 0.
   */
  offset?: number;
  /**
   * Ticker-wide summary of the quarter's biggest position changes. Sent only when you
   * passed `limit`, since it exists to spare a paging caller a full scan.
   */
  notableChanges?: HolderNotableChanges;
}

/**
 * The flows payload inside the response envelope: `institutional.getFlows()` returns
 * `PreviewResponse<InstitutionalFlows>`, so read the flows as `result.data.inflows`.
 */
export interface InstitutionalFlows {
  inflows: InstitutionalFlow[];
  outflows: InstitutionalFlow[];
  /**
   * Quarter these flows are for (ISO date). Populated when `reportDate` is omitted from
   * the request so the caller knows which quarter the server defaulted to.
   */
  reportDate?: string;
  /**
   * True when `reportDate` is a still-open 13F filing window (within 45 days of quarter
   * end), so only early filers are represented and the flows are partial.
   */
  isPending?: boolean;
  /** Distinct 13F filers represented in this quarter. Present only when `isPending`. */
  filerCount?: number;
  /**
   * Distinct filers in the latest fully-filed quarter, as a coverage baseline for a
   * pending quarter (e.g. `filerCount` 578 of `baselineFilerCount` 8789). Present only
   * when `isPending`.
   */
  baselineFilerCount?: number;
}

/**
 * @deprecated Names the INNER flows payload, but `getFlows()` returns the envelope
 * {@link PreviewResponse}<{@link InstitutionalFlows}>. Kept as an alias of the inner
 * shape so an existing import still resolves; will be removed in a future release.
 */
export type InstitutionalFlowsResponse = InstitutionalFlows;

export interface GetFlowsOptions {
  limit?: number;
}

/**
 * Paging and sort options for `institutional.getHolders`.
 *
 * `limit` is the switch for the whole set: sent on its own it pages, and it is also what
 * turns on `offset`, `sortBy`, `sortDir`, and the `returnedCount` / `offset` /
 * `notableChanges` fields on the response. Send any of the others without `limit` and the
 * server ignores them and returns the full unsorted list, silently, with a 200.
 */
export interface GetHoldersOptions {
  /**
   * Maximum holder rows to return. Must be >= 1; values above 1000 are capped
   * server-side. Omit to get the full, unbounded holder list.
   */
  limit?: number;
  /** Row offset to start from. Server default is 0. Requires `limit`. */
  offset?: number;
  /** Sort field. Server default is `"shares"`. Requires `limit`. */
  sortBy?: "shares" | "valueUsd" | "sharesChangePct";
  /** Sort direction. Server default is `"desc"`. Requires `limit`. */
  sortDir?: "asc" | "desc";
}

/** A single institution summary from the discovery list. */
export interface InstitutionSummary {
  /** SEC Central Index Key of the (rolled-up) institution. */
  cik: string;
  /** URL slug for routing to `getInstitutionDetail`. */
  urlSlug: string;
  displayName: string;
  /** Filer category, or null if unclassified. */
  filerCategory: string | null;
  /** Total AUM in USD for the quarter (rolled-up across the filer group). */
  totalValueUsd: number;
  /** Distinct equity tickers held this quarter (rolled-up, de-duped). */
  holdingsCount: number;
  /** True when this institution aggregates multiple related filer CIKs. */
  multiCikRollup: boolean;
  /** Number of subsidiary filers rolled up under this institution (0 when not a rollup). */
  childCikCount: number;
}

/** The `data` payload of the institution discovery list. */
export interface InstitutionList {
  /** Quarter of the AUM snapshot, e.g. `"2026Q1"`. */
  quarter: string;
  /** Total institutions matching the filters, before pagination. */
  totalCount: number;
  offset: number;
  limit: number;
  institutions: InstitutionSummary[];
}

/** Wire envelope for the discovery list (always full, never a preview). */
export interface InstitutionListResponse {
  isPreview: boolean;
  previewReason: "PRO_REQUIRED" | null;
  data: InstitutionList;
}

export interface ListInstitutionsOptions {
  /** Filer category filter (e.g. `"HEDGE_FUND"`). */
  category?: string;
  /** Minimum total AUM in USD (e.g. `10_000_000_000`). */
  minAumUsd?: number;
  /** Page size (default 50, max 200). */
  limit?: number;
  /** Pagination offset (default 0). */
  offset?: number;
  /** `"aumDesc"` (default), `"aumAsc"`, or `"nameAsc"`. */
  sort?: "aumDesc" | "aumAsc" | "nameAsc";
  /** AUM snapshot quarter as `YYYYQN` (e.g. `"2026Q1"`); defaults to latest. */
  quarter?: string;
}

// ── Insider Trading ──────────────────────────────────────────

export interface InsiderActivitySummary {
  ticker: string;
  companyName: string;
  tradeCount: number;
  insiderCount: number;
  totalShares: number;
  totalValue: number;
  latestDate: string;
  latestInsider: string;
  latestTitle: string;
}

export interface InsiderActivityResponse {
  buys: InsiderActivitySummary[];
  sells: InsiderActivitySummary[];
}

export interface InsiderTrade {
  ticker: string;
  companyName: string;
  insiderName: string;
  insiderTitle: string;
  insiderRelation: "OFFICER" | "DIRECTOR" | "TEN_PCT_OWNER" | "OTHER";
  officer: boolean;
  director: boolean;
  tenPctOwner: boolean;
  transactionDate: string;
  filedDate: string;
  transactionCode: string;
  transactionType: "BUY" | "SELL" | "EXERCISE" | "AWARD" | "GIFT" | "OTHER";
  securityTitle: string;
  /** The security the row was filed in when it is not the US listing `ticker` names (e.g. "Common Shares (2330.TW)"); null on the ordinary case, and when set `pricePerShare` is null because the filed price is per foreign ordinary share. */
  securityBasis?: string | null;
  sharesTransacted: number;
  pricePerShare: number | null;
  totalValue: number;
  sharesOwnedAfter: number | null;
  directOwnership: boolean;
  /** True only when the trade was under a confirmed Rule 10b5-1 pre-planned trading plan. */
  rule10b51: boolean;
}

export interface ClusterBuy {
  ticker: string;
  companyName: string;
  insiderCount: number;
  tradeCount: number;
  totalShares: number;
  totalValue: number;
  firstBuyDate: string;
  lastBuyDate: string;
}

export interface GetInsiderOptions {
  /** Number of days to look back (1–365). Defaults to 90. */
  lookbackDays?: number;
}

// ── Politicians Trading ─────────────────────────────────────

/**
 * Asset-type-specific detail on a congressional trade.
 *
 * `null` for plain `Stock`/`ETF` holdings. When present it is a discriminated
 * ("oneOf") shape keyed by `kind`. Today only options carry metadata; new asset
 * types slot in additively under their own `kind`. Only the fields relevant to
 * `kind` are present.
 */
export interface AssetMetadata {
  /** Discriminator; currently only `"OPTION"`. */
  kind: "OPTION";
  /** `"CALL"` or `"PUT"` (OPTION). */
  optionType?: "CALL" | "PUT";
  /** Strike in dollars (OPTION). */
  strikePrice?: number;
  /** Expiry as ISO `"YYYY-MM-DD"` (OPTION). */
  expirationDate?: string;
}

/** A congressional STOCK Act trade disclosure. */
export interface CongressTrade {
  politicianName: string;
  firstName: string;
  lastName: string;
  chamber: "SENATE" | "HOUSE";
  /**
   * Party affiliation, or `null` when the disclosure carries none. Nulls are uncommon but
   * real on the ticker-scoped feed, so build a label from what is present rather than
   * interpolating this directly.
   */
  party: string | null;
  /** Two-letter state, or `null` when the disclosure carries none. Same caveat as `party`. */
  state: string | null;
  bioguideId: string;
  imageUrl: string | null;
  ticker: string;
  assetDescription: string;
  assetType: "Stock" | "ETF" | "Stock Option";
  /**
   * Structured asset detail, or `null`/absent for plain stocks and ETFs.
   * For options carries optionType/strikePrice/expirationDate under `kind: "OPTION"`.
   */
  assetMetadata?: AssetMetadata | null;
  transactionType: "PURCHASE" | "SALE" | "EXCHANGE" | "OTHER";
  transactionDate: string;
  disclosureDate: string;
  disclosureDelayDays: number;
  /** Raw STOCK Act range (e.g., "$1,001 - $15,000"). */
  amountRange: string;
  amountMin: number;
  amountMax: number;
  owner: "Self" | "Spouse" | "Child" | "Joint";
  urlSlug: string;
  sentiSenseScore: number | null;
}

/** Summary statistics for a tracked politician. */
export interface PoliticianSummary {
  urlSlug: string;
  displayName: string;
  firstName: string;
  lastName: string;
  chamber: "SENATE" | "HOUSE";
  party: string;
  state: string;
  bioguideId: string;
  imageUrl: string | null;
  kbEntityId: string | null;
  totalTrades: number;
  purchaseCount: number;
  saleCount: number;
  latestTradeDate: string | null;
  sentiSenseScore: number | null;
  /**
   * True for a member who has left Congress. The members roster serves only sitting
   * members, so this reads true only on a member detail or directory response. Render
   * the tense accordingly ("Former Senator").
   */
  former: boolean;
  /** Year the member left Congress, e.g. `"2021"`. Null for a sitting member. */
  servedUntil: string | null;
}

/** One entry in the member discovery directory: identity and page slug, no trade data. */
export interface PoliticianDirectoryEntry {
  urlSlug: string;
  displayName: string;
  chamber: "SENATE" | "HOUSE";
  party: string;
  state: string;
  bioguideId: string;
  imageUrl: string | null;
  /** True for a member who has left Congress. */
  former: boolean;
  /** Year the member left Congress, e.g. `"2021"`. Null for a sitting member. */
  servedUntil: string | null;
}

/** The `data` payload of the member discovery directory. */
export interface PoliticianDirectory {
  /** Total members matching the filter, before pagination. */
  totalCount: number;
  members: PoliticianDirectoryEntry[];
}

/** Wire envelope for the directory (always full, never a preview). */
export interface PoliticianDirectoryResponse {
  isPreview: boolean;
  previewReason: "PRO_REQUIRED" | null;
  data: PoliticianDirectory;
}

export interface GetPoliticianDirectoryOptions {
  /** Case-insensitive filter across display name, state and slug. */
  q?: string;
  /** Page size (default 50, max 200). */
  limit?: number;
  /** Pagination offset (default 0). */
  offset?: number;
}

/** Detailed politician profile with recent trades and top tickers. */
export interface PoliticianDetail {
  profile: PoliticianSummary;
  recentTrades: CongressTrade[];
  topTickers: string[];
}

export interface GetPoliticiansOptions {
  /** Number of days to look back (1-365). Defaults to 90. */
  lookbackDays?: number;
}

/**
 * Options for `politicians.getActivity`, which pages on top of the shared lookback window.
 *
 * The market-wide feed is far longer than one response: a 90-day window is routinely well
 * over a thousand disclosures and the server returns 200 of them by default. Read
 * `totalCount` on the envelope to size the walk, then step through with `limit` and
 * `offset`. Omitting both keeps the original single 200-row request.
 */
export interface GetPoliticianActivityOptions extends GetPoliticiansOptions {
  /**
   * Rows to return. Must be >= 1; the server rejects 0 or negative with HTTP 400
   * (`invalid_limit`) and caps anything above 500 at 500. Omit for the default 200.
   */
  limit?: number;
  /**
   * Row offset to start from. Defaults to 0, and unlike the holders endpoint it works
   * without `limit`. An offset past the end returns an empty `data` array, not an error.
   */
  offset?: number;
}

/** Paging over one member's trade history on `getMember`. */
export interface GetPoliticianMemberOptions {
  /**
   * Trades to return. Must be >= 1; the server rejects 0 or negative with HTTP 400
   * (`invalid_limit`) and caps anything above 500 at 500. Omit for the default 200,
   * which covers a member's entire history for all but a dozen of them.
   */
  limit?: number;
  /**
   * Trade offset to start from. Defaults to 0. An offset past the end returns an
   * empty `recentTrades` array, not an error.
   */
  offset?: number;
}

/** Generic preview wrapper used by PRO-gated endpoints. */
// ── Calendar ────────────────────────────────────────────────

export interface EarningsEvent {
  ticker: string;
  companyName: string;
  /** Report date, ISO calendar day "YYYY-MM-DD". */
  earningsDate: string;
  /** Session timing. */
  earningsTime: "before_open" | "after_close" | "during_market" | "unknown";
  /** Fiscal period label (e.g. "Q2 2026"), nullable. */
  fiscalQuarter: string | null;
  /** Whether the company has confirmed the date (vs. estimated/projected). */
  confirmed: boolean;
  /** Consensus EPS estimate, nullable. */
  estimatedEps: number | null;
}

export interface CalendarMeta {
  /** When the snapshot was generated, epoch seconds. */
  generatedAt: number | null;
  /** First day covered, ISO "YYYY-MM-DD". */
  windowStart: string | null;
  /** Last day covered, ISO "YYYY-MM-DD". */
  windowEnd: string | null;
  /** Number of events in this response. */
  count: number;
  /** Always "sentisense". */
  source: string;
}

export interface EarningsCalendarResponse {
  earnings: EarningsEvent[];
  metadata: CalendarMeta;
}

export interface GetEarningsCalendarOptions {
  /** Filter to a single ticker. */
  ticker?: string;
  /** Shorthand window: "this" (current Mon-Sun) or "next". */
  week?: "this" | "next";
  /** Inclusive lower date bound, ISO "YYYY-MM-DD". Overrides `week`. */
  from?: string;
  /** Inclusive upper date bound, ISO "YYYY-MM-DD". */
  to?: string;
  /** When true, only company-confirmed dates. */
  confirmed?: boolean;
  /** Session filter. */
  time?: "before_open" | "after_close" | "during_market" | "unknown";
}

// ── Earnings analysis report ────────────────────────────────

/**
 * One KPI card on a reported quarter.
 *
 * `value` and `yoy` are display strings, already formatted (`"$109.4B"`,
 * `"+16% YoY"`), not numbers to compute with. `yoy` is absent when the quarter
 * carries no year-over-year comparison for that line, which is common on
 * call highlights.
 */
export interface EarningsKpiHighlight {
  label: string;
  value: string;
  yoy?: string;
}

/** A citation backing a reported quarter. */
export interface EarningsSource {
  title: string;
  url: string;
}

/**
 * One fiscal quarter of the earnings analysis report, from
 * `client.earnings.getSummaries()`.
 *
 * The wire shape depends on the caller's tier, so branch on the envelope's
 * `isPreview` rather than on field presence. `fiscalPeriod`, `reportDate`,
 * `headline`, `hasTranscript`, `generatedAt` and `source` arrive on both tiers.
 *
 * PRO adds the bodies: `summaryMd`, the full `kpiHighlights`, `guidance`,
 * `transcriptSummaryMd`, `transcriptHighlights`, `transcriptGeneratedAt` and
 * `sources`.
 *
 * The FREE preview replaces those bodies with shape: up to two `kpiHighlights`
 * cards (without `yoy`) plus `kpiHighlightCount`, the section titles in
 * `summaryTopics` and `transcriptTopics`, and `hasGuidance` with
 * `guidanceDirection` in place of the guidance language. It never carries a
 * body, a KPI history, or a guidance figure.
 *
 * Absence is explicit: a quarter with no call summary sets `hasTranscript` to
 * `false` rather than dropping the concept, so a client can say "no call
 * summary yet" instead of rendering nothing.
 */
export interface EarningsQuarter {
  /** Display fiscal period, e.g. `"Q2 FY2026"`. */
  fiscalPeriod: string;
  /** Date the results were reported, ISO calendar day `"YYYY-MM-DD"`. */
  reportDate: string;
  /** One-line editorial summary of the quarter. */
  headline: string;
  /** True when a summary of the earnings call exists for this quarter. */
  hasTranscript: boolean;
  /** When the quarter summary was generated, epoch seconds. */
  generatedAt: number;
  /** Provenance of the quarter summary. */
  source: "press_release" | "transcript";

  /** PRO: markdown body summarizing the reported results. */
  summaryMd?: string;
  /** PRO carries the full set; a preview carries up to two cards without `yoy`. */
  kpiHighlights?: EarningsKpiHighlight[];
  /** PRO: forward-guidance language as reported. Absent when the quarter carries none. */
  guidance?: string;
  /** PRO: markdown body summarizing the call. Absent when `hasTranscript` is false. */
  transcriptSummaryMd?: string;
  /** PRO: call-specific highlights. Absent when there is no call summary. */
  transcriptHighlights?: EarningsKpiHighlight[];
  /** PRO: when the call summary was generated, epoch seconds. Can post-date `generatedAt`. */
  transcriptGeneratedAt?: number;
  /** PRO: citations backing the quarter. */
  sources?: EarningsSource[];

  /** Preview: how many KPI cards the full quarter carries. */
  kpiHighlightCount?: number;
  /** Preview: section titles of the summary, never body text. */
  summaryTopics?: string[];
  /** Preview: section titles of the call summary, never body text. */
  transcriptTopics?: string[];
  /** Preview: whether the quarter carries guidance at all. */
  hasGuidance?: boolean;
  /** Preview: the direction only, in place of the guidance language. */
  guidanceDirection?: "RAISED" | "CUT" | "HELD" | "MIXED" | null;
}

/** One company that reported inside the recent window. */
export interface RecentEarningsEntry {
  ticker: string;
  /** Display fiscal period, e.g. `"Q2 FY2026"`. */
  fiscalPeriod: string;
  /** Date the results were reported, ISO calendar day `"YYYY-MM-DD"`. */
  reportDate: string;
  headline: string;
  /** True when a summary of the earnings call exists for this quarter. */
  hasTranscriptSummary: boolean;
  /** Latest content written for this quarter, epoch seconds. */
  generatedAt: number;
}

export interface GetEarningsSummariesOptions {
  /**
   * Max quarters returned, 1 to 40. Omitted, the API applies its own default
   * of 12. A FREE key receives one quarter whatever you pass.
   */
  limit?: number;
}

export interface GetRecentEarningsOptions {
  /** Look-back window in days, 1 to 31. Omitted, the API applies its own default of 7. */
  days?: number;
  /** Max rows returned, 1 to 100. Omitted, the API applies its own default of 50. */
  limit?: number;
}

/**
 * What lifts the gate on a preview response, in a form you can show a user directly.
 *
 * Present only when `isPreview` is `true`. Every field is optional: the copy and the
 * offer are set server-side and can change without an SDK release, so read what is
 * there rather than depending on any one field.
 */
export interface UpgradeHint {
  /** Plan that lifts the gate, e.g. `"PRO"`. */
  plan?: string;
  /** One sentence naming what was withheld. Safe to show verbatim. */
  message?: string;
  /** Current price, including any active discount code. */
  price?: string;
  /** Where to complete the upgrade. */
  url?: string;
  /** What an automated caller should do with this object. */
  relay?: string;
}

export interface PreviewResponse<T> {
  isPreview: boolean;
  previewReason: "PRO_REQUIRED" | null;
  /**
   * How to lift the gate. Present only on a preview; absent from full responses.
   * Surface `message` and `url` to your user rather than hard-coding a price.
   */
  upgrade?: UpgradeHint;
  /**
   * Size of the full result set, before any truncation your response went through.
   *
   * Sent whenever the server knows that number and the response might not hold all of it:
   * on a preview (`isPreview: true`), so you can render "showing N of totalCount", and on a
   * paged endpoint such as `politicians.getActivity`, where it is the full match count for
   * your filters on every tier, including a PRO response with `isPreview: false`.
   *
   * Absent on the endpoints that simply return everything, so a missing `totalCount` means
   * "ask `data` for the count", never "zero results".
   */
  totalCount?: number;
  data: T;
}

// ── Entity Metrics (v2 Serving Metrics) ───────────────────

/** Supported metric types for the v2 Serving Metrics API. */
export type MetricType =
  | "mentions"
  | "sentiment"
  | "sentisense_score"
  /**
   * The SentiSense Rating score, 0 to 100. Time series only: it has no source
   * breakdown, so `getDistribution` answers with an empty distribution for it.
   */
  | "sentisense_rating"
  | "social_dominance"
  | "creators";

/** Options for `EntityMetrics.getMetrics()`. */
export interface MetricsOptions {
  /** Metric to retrieve. Defaults to `"sentiment"`. */
  metricType?: MetricType;
  /** Start of the time range (epoch milliseconds). */
  startTime?: number;
  /** End of the time range (epoch milliseconds). */
  endTime?: number;
  /** Maximum number of data points to return. */
  maxDataPoints?: number;
}

/** Options for `EntityMetrics.getDistribution()`. */
export interface MetricDistributionOptions {
  /** Dimension to break the metric down by. Defaults to `"source"`. */
  dimension?: string;
}

/** A single data point returned by the v2 time-series metrics endpoint. */
/**
 * The value envelope on a {@link ServingMetric}. For a count metric (e.g. `mentions`) the
 * scalar is `value` directly (a number); for a value metric (e.g. `sentiment`, a polarity in
 * [-1, 1]) it is nested one level deeper at `value.value`.
 */
export interface ServingMetricValue {
  value: number | { value: number; valueType?: string };
  type?: string;
  valueType?: string;
  [key: string]: unknown;
}

export interface ServingMetric {
  /** Unix timestamp in milliseconds. */
  timestamp: number;
  /** The metric type, e.g. "SENTIMENT" or "MENTIONS". */
  metricType?: string;
  /**
   * The full metric value, including the stats block. For just the scalar, prefer the flat
   * `value` field below; this nests the scalar at `metricValue.value` (count metrics) or
   * `metricValue.value.value` (value metrics, e.g. sentiment polarity).
   */
  metricValue?: ServingMetricValue;
  /**
   * The flattened scalar reading for this point: the polarity for a `sentiment` metric, the
   * count for `mentions`. Populated on the wire, so prefer it over walking `metricValue`.
   * Absent when the point has no reading (treat as "no reading", not `0`).
   */
  value?: number;
  [key: string]: unknown;
}

/** Distribution data returned by the v2 distribution endpoint. */
export interface MetricDistribution {
  [key: string]: unknown;
}

// ── Market Mood & Market Summary ─────────────────────────────

export interface MarketMood {
  [key: string]: unknown;
}

/** AI-generated market summary with headline and analysis. */
export interface MarketSummary {
  /** Not populated by the API (always empty); retained for backward compatibility. */
  totalMentions: number;
  /** Not populated by the API (always empty); retained for backward compatibility. */
  topActiveStocks: string[];
  /** Timestamp when this data was last updated (epoch milliseconds). */
  lastUpdated: number;
  /** 1-2 sentence headline/punchline (may be null if unavailable). */
  headline: string | null;
  /** Full markdown analysis content (may be null if unavailable). */
  expandedContent: string | null;
  /** Timestamp when the AI summary was generated (epoch seconds, may be null). */
  generatedAt: number | null;
}

// ── Insights ─────────────────────────────────────────────────

/** A single AI-generated trading insight. */
export interface Insight {
  /** Category of the signal (e.g., `"insider_buy_signal"`, `"institutional_position_change"`, `"volume_anomaly_high"`). */
  insightType: string;
  /** Full AI-generated description of the signal. */
  insightText: string;
  /** Model confidence score (0.0–1.0). */
  confidence: number;
  /** Signal priority: `"low"`, `"medium"`, or `"high"`. */
  urgency: "low" | "medium" | "high";
  /** When this insight was generated (epoch seconds). */
  generatedAt: number;
  /** Source document references (may be null). */
  docRefs?: Record<string, unknown>[] | null;
  /** JSON string with additional signal metadata (may be null). */
  metadata?: string | null;
}

/** A locked insight entry shown to free users: metadata only, no insight text. */
export interface LockedInsight {
  insightType: string;
  urgency: string;
  generatedAt: number;
}

/**
 * @deprecated The insights endpoints return `PreviewResponse<Insight[]>`, not this shape.
 * No endpoint emits `insights` or `locked`. Kept only so an existing import resolves;
 * will be removed in a future release.
 */
export interface InsightPreviewResponse {
  isPreview: true;
  previewReason: "PRO_REQUIRED";
  /** Full insight objects for the top N results. */
  insights: Insight[];
  /** Metadata-only entries for the remaining signals. */
  locked: LockedInsight[];
}

/** Options for `Insights.stock()`. */
export interface GetInsightsOptions {
  /** Filter by urgency level: `"low"`, `"medium"`, or `"high"`. */
  urgency?: string;
  /** Filter by insight type (e.g., `"insider_buy_signal"`). */
  insightType?: string;
}

// ── KPIs ───────────────────────────────

/** One period value in a KPI time series. */
export interface KpiDataPoint {
  /** e.g. "Q2 FY2026" */
  period: string;
  /** ISO date, e.g. "2025-12-27" */
  date: string;
  value: number;
  /** Preliminary flag; often null. */
  isEstimate?: boolean | null;
}

/** A single KPI time series for a company. */
export interface KpiSeries {
  /** Stable per-ticker identifier, e.g. "iphone_revenue". */
  id: string;
  /** Human-readable name, e.g. "iPhone Revenue". */
  name: string;
  /** Logical category, e.g. "product_revenue", "segment_revenue". */
  category: string;
  /** Unit of measurement, e.g. "USD". */
  unit: string;
  /** Display hint, e.g. "currency_abbreviated". */
  displayFormat: string;
  /** Default chart type, e.g. "bar" or "line". */
  chartType: string;
  /** Time-series data points. */
  values: KpiDataPoint[];
  /** Citation for the source filing. */
  sourceRef?: string;
  /** Set when the company has stopped reporting this metric. */
  discontinued?: boolean;
  /** Optional human-readable note about discontinuation. */
  discontinuedNote?: string;
}

/** Full KPI payload for a company. Returned by `client.stocks.getKpis`. */
export interface CompanyKpisData {
  ticker: string;
  companyName: string;
  cik?: string;
  lastUpdated: string;
  kpis: KpiSeries[];
}

/** Lightweight coverage entry. Returned by `client.stocks.listKpiCoverage`. */
export interface KpiCoverageEntry {
  ticker: string;
  companyName: string;
  lastUpdated: string;
  kpiCount: number;
}

/** Coverage listing envelope: count + list of covered tickers. */
export interface KpiCoverageResponse {
  count: number;
  tickers: KpiCoverageEntry[];
}

/** Lightweight KPI metadata tuple. Returned by `client.stocks.getKpiTypes`. */
export interface KpiTypeEntry {
  id: string;
  name: string;
  category: string;
  chartType: string;
}


// ── Knowledge Base ──────────────────────────────────────────

export interface KBEntity {
  entityId: string;
  name: string;
  [key: string]: unknown;
}


// ── Trackers ────────────────────────────────────────────────
//
// Trackers are observational data products. Every tracker (institution rankings,
// hedge-fund reported returns, social trackers, surveillance
// dashboards) returns the same standardized `TrackerSnapshot` envelope.
// Dispatch on `viewType` to pick a renderer; consumers write one renderer per
// viewType and get every tracker for free.

/** Per-tracker discovery row returned by `client.trackers.list()`. */
export interface TrackerListing {
  trackerId: string;
  displayName: string;
  /** Coarse grouping for hub filtering: `"institutional"`, `"epidemiology"`, etc. */
  category: string;
  /** Sentence-long subtitle for hub cards + API discovery. */
  description: string;
  /** Renderer hint: `"table"`, `"choropleth"`, `"timeseries"`, `"heatmap"`. */
  viewType: string;
  /** Access tier: `"free"` or `"pro"`. A `pro` tracker truncates to a free preview for FREE callers; a `free` tracker returns the full snapshot to everyone. */
  accessTier?: string;
  /** Fragment on `/methodology` explaining the tracker (e.g. `"#institution-rankings"`). */
  methodologyAnchor: string;
  /** Expected snapshot refresh cadence, in seconds. Informational. */
  refreshIntervalSeconds: number;
  /** Canonical detail URL (e.g. `"/api/v1/trackers/institution-concentration"`). */
  canonicalUrl: string;
}

/** Discovery envelope returned by `client.trackers.list()`. */
export interface TrackerListResponse {
  trackers: TrackerListing[];
}

/** One row of a `viewType: "table"` tracker: a ranked leaderboard cell. */
export interface TrackerTableRow {
  /** 1-based rank on the sort the tracker is built for; may be null. */
  rank: number | null;
  /** Stable identifier for the entity (CIK, ticker, etc.). */
  rowId: string;
  /** Display name. */
  name: string;
  /** Optional category tag (e.g. `"HEDGE_FUND"`). */
  category: string | null;
  /** Optional canonical link to the entity behind the row (e.g. `"/institutions/Berkshire-Hathaway"`). */
  url: string | null;
  /** Per-cell metric values; each carries its own label and unit. */
  metrics: TrackerMetricValue[];
}

/**
 * A labeled quantitative reading attached to a row, geo region, or
 * time-series point. `value` is `unknown` because it can be a number or a
 * status string ("Severe", "Resolved") without forcing a separate type.
 */
export interface TrackerMetricValue {
  label: string;
  value: unknown;
  unit?: string | null;
  trend?: string | null;
  /** Primary-source URL for this cell's value, when the tracker is citation-backed. */
  sourceUrl?: string | null;
  /** Short quote from the primary source supporting this cell's value. */
  sourceQuote?: string | null;
  /** The period this cell refers to (e.g. "2025", "2026-YTD"), when it varies per row. */
  periodLabel?: string | null;
}

/** Top-of-page stat tile. A tracker may have 0–N headline metrics. */
export interface TrackerHeadlineMetric {
  label: string;
  value: unknown;
  unit?: string | null;
  asOf?: string | null;
  methodologyNote?: string | null;
  trend?: string | null;
}

/** One geographic row for a `viewType: "choropleth"` tracker. */
export interface TrackerGeoEntry {
  geoId?: string | null;
  /** Two-letter ISO country code, when applicable. */
  isoCode?: string | null;
  /** FIPS code with leading zeros preserved (e.g. `"06"`), when applicable. */
  fips?: string | null;
  name: string;
  metrics: TrackerMetricValue[];
  lastEvent?: { date?: string; url?: string; summary?: string } | null;
}

/** One point on a time series for a `viewType: "timeseries"` tracker. */
export interface TrackerTimeSeriesPoint {
  /** Free-form date string; trackers pick the granularity. */
  date: string;
  label?: string | null;
  values: TrackerMetricValue[];
}

/** A notable event (outbreak, disruption, enforcement action). */
export interface TrackerEvent {
  id: string;
  title: string;
  status: string;
  asOf?: string | null;
  severity?: string | null;
  geoIds?: string[] | null;
  metrics?: TrackerMetricValue[] | null;
  summary?: string | null;
  sources?: TrackerSourceRef[] | null;
}

/** Recent news/alert signal. `tier`: 1=authoritative, 2=secondary, 3=mainstream press. */
export interface TrackerSignal {
  tier?: number | null;
  source: string;
  publishedAt: string;
  url: string;
  summary?: string | null;
}

/** Citation reference. */
export interface TrackerSourceRef {
  name: string;
  url: string;
  date?: string | null;
}

/**
 * Standardized envelope every tracker returns. Exactly one of the payload
 * fields (`rows`, `geo`, `timeSeries`) is populated based on `viewType`;
 * `headline`, `events`, `signals`, `sources`, and `narrative` are
 * companion fields that may appear on any tracker.
 */
export interface TrackerSnapshot {
  trackerId: string;
  /** Optional sub-scope (e.g. `"us"` for hantavirus). Null for unscoped trackers. */
  scope?: string | null;
  schemaVersion: string;
  displayName: string;
  description?: string | null;
  /** Renderer hint: `"table"`, `"choropleth"`, `"timeseries"`, `"heatmap"`. */
  viewType: string;
  /** Free-form "data as of" label (typically a quarter, date, or week). */
  asOf?: string | null;
  generatedAt?: string | null;
  generatedBy?: string | null;
  /** Optional Markdown narrative. */
  narrative?: string | null;
  headline?: TrackerHeadlineMetric[] | null;
  geo?: TrackerGeoEntry[] | null;
  timeSeries?: TrackerTimeSeriesPoint[] | null;
  /** Populated when `viewType === "table"`. */
  rows?: TrackerTableRow[] | null;
  events?: TrackerEvent[] | null;
  signals?: TrackerSignal[] | null;
  sources?: TrackerSourceRef[] | null;
}

/**
 * Wire response from `client.trackers.get()`. The snapshot is at `.data`;
 * for FREE callers on a PRO-gated tracker, `isPreview` is `true`, `data`
 * carries a truncated row set, and `totalCount` reports the full set size.
 */
export interface TrackerSnapshotResponse {
  isPreview: boolean;
  /** `"PRO_REQUIRED"` for FREE callers on a gated tracker; otherwise `null`. */
  previewReason: "PRO_REQUIRED" | null;
  /** Full row count before truncation. Only set on preview responses. */
  totalCount?: number;
  /** How to lift the gate. Only set on preview responses. */
  upgrade?: UpgradeHint;
  data: TrackerSnapshot;
}

// ── Indexes ─────────────────────────────────────────────────

/** Per-index discovery row returned by `client.indexes.list()`. */
export interface IndexListing {
  indexId: string;
  displayName: string;
  /** One-sentence summary, suitable for a card subtitle. */
  description: string;
  /** Output scale: `"SENTIMENT"` (signed, -1 to +1) or `"PERCENT_0_100"`. Set axis bounds from this, not from the id. */
  scale: string;
  /** Access tier: `"free"` or `"pro"`. Every index is `"free"` today; read it rather than assuming. */
  accessTier?: string;
  /**
   * Richest view of this index, which is NOT always the detail route. Market
   * Mood points at `/api/v2/market-mood`, which carries a phase band, weekly
   * change, per-signal breakdown and per-sector map that the shared envelope
   * cannot hold. Every advertised `indexId` still resolves on
   * {@link Indexes.get}, so a generic client can iterate the listing without
   * special-casing anything.
   */
  canonicalUrl: string;
}

/** Discovery envelope returned by `client.indexes.list()`. */
export interface IndexListResponse {
  indexes: IndexListing[];
}

/** One entity's row in a basket index's constituent breakdown. */
export interface IndexConstituent {
  /** Ontology entity id, resolvable via the entities API. */
  kbEntityId: string;
  displayName: string;
  /** The entity's role in this basket; the role is what carries the weight. */
  role: string;
  /** Relative weight on this date. `0` when `staleness` is `"OUT_OF_SEGMENT"`. */
  weight: number;
  /** The entity's own reading. */
  value: number | null;
  /** Mentions behind that reading in the lookback window. */
  mentionsCount: number | null;
  /**
   * `"FRESH"` (mentioned inside the lookback), `"CARRIED_FORWARD"` (last known
   * value standing in), `"EXCLUDED"` (no usable reading, renormalized out), or
   * `"OUT_OF_SEGMENT"` (not in the basket on this date, reported only for
   * transparency).
   */
  staleness: string;
  /**
   * Reserved. The API currently returns `null` here on every constituent, so do
   * not build on it. To get the same number today, compute `weight * value`
   * over the sum of `weight` across constituents whose `staleness` is not
   * `"EXCLUDED"`.
   */
  contribution: number | null;
  /** Detail page for the entity, or `null` when there is no resolvable target. */
  link: string | null;
}

/**
 * Latest reading for one index, returned by `client.indexes.get()`.
 *
 * Two archetypes share this envelope, and the difference is load-bearing. A
 * **basket** index (`fed-sentiment`, `ai-sentiment`) weight-averages tracked
 * entities, so `constituents`, `basketSize`, `coverage` and `totalMentions`
 * describe how the headline was built. A **composite** index (`market-mood`) is
 * built from signals rather than entities, so those four are `null` *by
 * construction*, not because data is missing. Branch on them; never treat
 * `null` there as an error.
 */
export interface IndexSnapshot {
  indexId: string;
  displayName: string;
  /** Date the reading covers, `"YYYY-MM-DD"`. Bucket start for weekly indexes. */
  asOf: string;
  /** The headline scalar, on `scale`. */
  value: number | null;
  scale: string;
  /** Constituents that actually contributed. `null` on a composite index. */
  coverage: number | null;
  /** Constituents in the basket on this date. `null` on a composite index. */
  basketSize: number | null;
  /** Mentions behind the reading. `null` on a composite index. */
  totalMentions: number | null;
  /** How the value was computed, and what any `null` fields mean. */
  methodologyNote: string;
  /** Per-entity breakdown. `null` on a composite index. */
  constituents: IndexConstituent[] | null;
}

/** One point on an index's scalar series. */
export interface IndexHistoryPoint {
  /** `"YYYY-MM-DD"`. */
  date: string;
  value: number | null;
}

/**
 * Historical series returned by `client.indexes.history()`.
 *
 * Point spacing follows the index, not the calendar: a weekly index emits one
 * point per Monday-Sunday bucket, a daily index one per day, and Market Mood
 * trading days only. Thin or low-coverage buckets are withheld rather than
 * published, so `history` can be shorter than `days` and can contain gaps. Plot
 * against `date`; never assume a fixed interval, and never read a missing date
 * as zero.
 */
export interface IndexHistoryResponse {
  indexId: string;
  displayName: string;
  scale: string;
  /** The window you requested, echoed back. */
  days: number;
  history: IndexHistoryPoint[];
}

// ── Screener ─────────────────────────────────────────────────

/** One selectable value of an `ENUM` screener field. */
export interface ScreenerFieldOption {
  /** The number a filter carries for this reading. */
  value: number | null;
  /** Display copy. */
  label: string;
}

/**
 * One filterable field from `client.screener.fields()`.
 *
 * Build a filter UI from this rather than hardcoding the field list, and new
 * fields appear without an SDK release.
 *
 * `type` is `"NUMBER"`, `"ENUM"` or `"STRING"`:
 *
 * - `NUMBER` takes a scalar `value` and the comparison ops in `ops`.
 * - `ENUM` is an ordinal with a fixed set of readings; `options` carries them
 *   and `ops` is `["EQ"]`.
 * - `STRING` (ETF universe only) takes `IN` / `NOT_IN` against `values`, which
 *   is populated from the live universe rather than a static list, so pickers
 *   stay current.
 */
export interface ScreenerFieldDescriptor {
  /** The name a filter's `fieldName` carries, e.g. `"SENTI_SCORE_7D"`. */
  name: string;
  label: string;
  /** UI grouping, e.g. `"Sentiment"`, `"Analyst"`, `"Technical"`. */
  group: string;
  type: "NUMBER" | "ENUM" | "STRING" | (string & {});
  /** e.g. `"SCORE"`, `"PERCENT"`, `"USD"`. `null` on unitless fields. */
  unit: string | null;
  ops: string[];
  sortable: boolean;
  /** Suggested input step for a numeric control. */
  step: number | null;
  placeholder: string | null;
  description: string;
  /** `ENUM` fields only; `null` otherwise. */
  options: ScreenerFieldOption[] | null;
  /**
   * Thresholds worth offering as one-tap presets. On the SentiSense Score
   * fields these are the band edges (5, 13, 23).
   */
  quickValues: string[] | null;
  /** `STRING` fields only, populated from the live universe; `null` otherwise. */
  values: string[] | null;
}

/**
 * Both field catalogs, returned by `client.screener.fields()`.
 *
 * `stock` backs {@link Screener.run}; `etf` backs {@link Screener.runEtfs}. The
 * two universes do not share a field vocabulary, so a name from one is not
 * valid in the other.
 */
export interface ScreenerFieldCatalog {
  stock: ScreenerFieldDescriptor[];
  etf: ScreenerFieldDescriptor[];
}

/**
 * One filter leg. Filters are ANDed together; there is no OR, so run two
 * screens and merge.
 *
 * Identify the field with `fieldName`. The curated plans from
 * `client.screener.screens()` use the older `field` key instead, and both are
 * accepted on the way in, so read either when inspecting a plan you did not
 * build yourself.
 *
 * Numeric ops take `value`; `IN` / `NOT_IN` take `values` and are only
 * meaningful on the ETF universe's string fields.
 */
export interface ScreenerFilter {
  fieldName?: string;
  /** Legacy field key, as emitted by the curated screens. */
  field?: string;
  op: "GTE" | "LTE" | "GT" | "LT" | "EQ" | "NEQ" | "IN" | "NOT_IN";
  value?: number;
  values?: string[];
}

/** Sort spec. Nulls sort last regardless of direction. */
export interface ScreenerSort {
  fieldName?: string;
  /** Legacy field key, as emitted by the curated screens. */
  field?: string;
  dir: "ASC" | "DESC";
}

/**
 * A filter and sort plan. The same shape works for both universes; the endpoint
 * you call decides which one runs, so `universe` on a plan you pass in is a
 * no-op.
 *
 * `limit` is deliberately not on this object: it rides next to the plan on the
 * request, because a plan is a stored object and paging is a transport concern.
 */
export interface ScreenerPlan {
  universe?: "STOCK" | "ETF";
  filters: ScreenerFilter[];
  sort?: ScreenerSort;
  /** Present on curated plans; ignored on execution. */
  intent?: string;
  /** Present on curated plans; ignored on execution. */
  summary?: string;
}

/**
 * A curated screen from `client.screener.screens()`.
 *
 * `plan` round-trips straight back into {@link Screener.run} (or
 * {@link Screener.runEtfs} when `plan.universe === "ETF"`), so a curated screen
 * is both a ready-made query and a worked example of the plan shape.
 *
 * `id` is stable and safe to persist. `name` and `summary` are display copy and
 * may be revised. Two conventions in the names are load-bearing: `+` means both
 * conditions hold, `vs` means the two sides disagree.
 */
export interface FeaturedScreen {
  id: string;
  name: string;
  summary: string;
  plan: ScreenerPlan;
}

/** Envelope returned by `client.screener.screens()`. */
export interface ScreenerScreensResponse {
  screens: FeaturedScreen[];
}

/**
 * One matching stock. Every row carries the full field set rather than only the
 * fields you filtered on, so you can sort or post-process client side without a
 * second call. A field with no data for that ticker is `null`, and a row
 * missing the field you filtered on never matches in either direction.
 *
 * `sentiSenseScore7D` / `sentiSenseScore1M` are the SentiSense Score, not
 * sentiment polarity: unbounded, banded at 5 / 13 / 23 either side of zero.
 */
export interface ScreenerRow {
  ticker: string;
  /** 7-day average SentiSense Score. */
  sentiSenseScore7D: number | null;
  /** 1-month average SentiSense Score. */
  sentiSenseScore1M: number | null;
  /** 7-day Score minus the 1-month baseline; positive means strengthening. */
  scoreChange7D: number | null;
  /** Side of the neutral band the 7-day Score sits on: `1` / `0` / `-1`. */
  sentimentDirection: number | null;
  socialDominance: number | null;
  mentionShare: number | null;
  mentionVelocity: number | null;
  dominanceChange: number | null;
  /** USD. */
  marketCap: number | null;
  currentPrice: number | null;
  changePercent: number | null;
  change: number | null;
  volume: number | null;
  week52High: number | null;
  week52Low: number | null;
  /** Signed-negative percent below the 52-week high. */
  pctOff52wHigh: number | null;
  /** Signed-positive percent above the 52-week low. */
  pctOff52wLow: number | null;
  /** Share of rating analysts saying buy, 0..100. Higher is more bullish. */
  analystBuyRatioPct: number | null;
  analystTargetUpsidePct: number | null;
  analystCount: number | null;
  analystRatingMomentum30D: number | null;
  /** Vendor 1-to-5 scale. **INVERTED: 1.0 is strong buy.** */
  analystRatingMean: number | null;
  pctOff200dMa: number | null;
  pctOff50dMa: number | null;
  /** Ordinal: `1` golden cross, `-1` death cross, `0` neither. */
  maCrossState: number | null;
  return1M: number | null;
  return3M: number | null;
  return6M: number | null;
  return1Y: number | null;
  volatility30D: number | null;
  /** Daily Score values for the last 7 days, oldest first. */
  sentisenseScoreBars7D: number[] | null;
  /** Weekly-grouped Score values across the last 30 days, oldest first. */
  sentisenseScoreBars30D: number[] | null;
  /** Daily closes for the last 30 days, oldest first. */
  priceSparkline30D: number[] | null;
  /** Epoch seconds. */
  lastUpdated: number | null;
}

/**
 * One matching fund.
 *
 * The two Score readings answer different questions.
 * `constituentsWeightedSentisense` is the holdings-weighted SentiSense Score
 * across what the fund actually owns, which is usually the one you want;
 * `directSentisense` is the Score from chatter about the fund ticker itself,
 * which on a broad index fund is mostly macro noise.
 */
export interface EtfScreenerRow {
  ticker: string;
  name: string;
  issuer: string | null;
  assetClass: string | null;
  trackedIndex: string | null;
  /** AUM in USD. */
  marketCap: number | null;
  /** Percent points: `0.09` means 0.09%. */
  expenseRatio: number | null;
  currentPrice: number | null;
  changePercent: number | null;
  priceChange: number | null;
  volume: number | null;
  week52High: number | null;
  week52Low: number | null;
  pctOff52wHigh: number | null;
  pctOff52wLow: number | null;
  weightedAnalystUpside: number | null;
  weightedConsensusLabel: string | null;
  weightedInsiderNet30d: number | null;
  weightedInsiderNet90d: number | null;
  /** Holdings-weighted SentiSense Score across the fund's constituents. */
  constituentsWeightedSentisense: number | null;
  /** SentiSense Score from chatter about the fund ticker itself. */
  directSentisense: number | null;
  /** How much of the fund's weight had constituent data behind the weighted Score. */
  weightCoveredPct: number | null;
  holdingsCount: number | null;
  totalKnownHoldings: number | null;
  /** `true` when the holdings set behind the aggregates is incomplete. */
  partial: boolean | null;
  /** Epoch seconds. */
  lastUpdated: number | null;
}

/** Request body for both execute endpoints. */
export interface ScreenerExecuteOptions {
  plan: ScreenerPlan;
  /** Optional ticker subset. Omit to screen the whole tracked universe. */
  tickers?: string[];
  /** Rows to return. Defaults to 100 server-side, caps at 500. */
  limit?: number;
}

/**
 * Stock screen results.
 *
 * `matched` is how many rows the plan matched *before* `limit` was applied, so
 * truncation is visible: when `matched` exceeds `limit` you are looking at the
 * top slice under the plan's sort, not the whole answer.
 */
export interface ScreenerExecuteResponse {
  results: ScreenerRow[];
  matched: number;
  limit: number;
}

/** ETF screen results. Same envelope; `matched` is the pre-limit count. */
export interface EtfScreenerExecuteResponse {
  results: EtfScreenerRow[];
  matched: number;
  limit: number;
}
