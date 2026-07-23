// ── Client options ──────────────────────────────────────────

export interface SentiSenseOptions {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

// ── Stocks ──────────────────────────────────────────────────

export interface StockPrice {
  ticker: string;
  /** Regular-session price. During RTH: live last trade. Otherwise: most recent RTH close. */
  currentPrice: number;
  change: number;
  changePercent: number;
  previousClose: number;
  /** Regular-session volume. */
  volume: number;
  /** Unix timestamp in milliseconds of the price quote. */
  timestamp: number;
  /** Extended-hours view (pre-market or after-hours). Null/absent during RTH, overnight, and weekends. */
  extendedHours?: ExtendedHoursInfo | null;
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
  /** Regular-session price. During RTH: live last trade. Otherwise: most recent RTH close. */
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
  dividendYield: number | null;
  /** 200-day simple moving average of daily closes. Null when fewer than 200 trading days of history exist. */
  movingAverage200Day: number | null;
  timestamp: number | null;
  /** Extended-hours view (pre-market or after-hours). Null/absent during RTH, overnight, and weekends. */
  extendedHours?: ExtendedHoursInfo | null;
}

export interface StockDetail {
  ticker: string;
  name: string;
  kbEntityId?: string;
  urlSlug?: string;
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
  [key: string]: unknown;
}

export interface StockEntity {
  entityId: string;
  name: string;
  type: string;
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

export interface Fundamentals {
  ticker: string;
  timeframe: string;
  [key: string]: unknown;
}

export interface FundamentalsPeriod {
  fiscalPeriod: string;
  fiscalYear: number;
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
  timeframe?: "1D" | "5D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";
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
  published: number;
  averageSentiment: number;
  reliability: number;
  sentiment: SentimentEntry[];
}

/** Story cluster with title, sentiment, and metrics. */
export interface StoryCluster {
  id: string;
  title: string;
  clusterSize: number;
  averageSentiment: number;
  /** Unix timestamp in seconds when the cluster was assembled by our pipeline. */
  clusteredAt: number;
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
  days?: number;
  offset?: number;
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
   * `avgClosePrice` is missing — fall back to displaying `netSharesChange`.
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
}

export interface InstitutionalFlowsResponse {
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

export interface GetFlowsOptions {
  limit?: number;
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
  party: string;
  state: string;
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

export interface PreviewResponse<T> {
  isPreview: boolean;
  previewReason: "PRO_REQUIRED" | null;
  /**
   * Number of items in the full PRO dataset, before preview truncation.
   * Present on preview (free-tier) list responses so callers can show
   * "showing N of totalCount". Absent on full PRO responses.
   */
  totalCount?: number;
  data: T;
}

// ── Entity Metrics (v2 — Serving Metrics) ──────────────────

/** Supported metric types for the v2 Serving Metrics API. */
export type MetricType =
  | "mentions"
  | "sentiment"
  | "sentisense_score"
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

// ── Entity Metrics (v1 — deprecated) ───────────────────────

/** @deprecated Use `ServingMetric[]` from the v2 API instead. */
export interface MentionData {
  [key: string]: unknown;
}

/** @deprecated Use `ServingMetric[]` from the v2 API instead. */
export interface MentionCount {
  [key: string]: unknown;
}

/** @deprecated Use `ServingMetric[]` from the v2 API instead. */
export interface SentimentData {
  [key: string]: unknown;
}

/** @deprecated */
export interface EntityMetricsDateRange {
  startDate?: string;
  endDate?: string;
}

/** @deprecated */
export interface GetMentionsOptions extends EntityMetricsDateRange {
  source?: DocumentSource;
}

/** @deprecated */
export interface GetMentionCountOptions extends EntityMetricsDateRange {
  source?: DocumentSource;
}

/** @deprecated */
export interface GetSentimentBySourceOptions {
  date?: string;
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

/** Preview response returned to free/unauthenticated users on insights endpoints. */
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
// Trackers are observational data products. Every tracker — institution rankings,
// hedge-fund reported returns, social trackers, surveillance
// dashboards — returns the same standardized `TrackerSnapshot` envelope.
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

/** One row of a `viewType: "table"` tracker — a ranked leaderboard cell. */
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
  data: TrackerSnapshot;
}
