// ── Client options ──────────────────────────────────────────

export interface SentiSenseOptions {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

// ── Stocks ──────────────────────────────────────────────────

export interface StockPrice {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  timestamp: number;
}

export interface StockDetail {
  ticker: string;
  name: string;
  kbEntityId?: string;
  urlSlug?: string;
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
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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
  timeframe?: "1M" | "3M" | "6M" | "1Y";
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

export type DocumentSource = "news" | "reddit" | "x" | "substack";

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
  source: "NEWS" | "REDDIT" | "X" | "SUBSTACK";
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
  createdAt: number;
}

export interface Story {
  cluster: StoryCluster;
  displayTickers: string[];
  tickers: string[];
  primaryEntityNames: string[];
  impactScore: number;
  brokeAt: number;
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
  activistActivity: boolean;
  reportDate: string;
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
}

export interface GetFlowsOptions {
  limit?: number;
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
export interface ServingMetric {
  timestamp: number;
  value: number;
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
  /** Total mentions across all stocks. */
  totalMentions: number;
  /** Most active stock tickers by mention volume. */
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

// ── Knowledge Base ──────────────────────────────────────────

export interface KBEntity {
  entityId: string;
  name: string;
  [key: string]: unknown;
}
