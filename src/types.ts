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

export interface Document {
  id: string;
  text: string;
  subtext: string;
  url: string;
  source: "NEWS" | "REDDIT" | "X" | "SUBSTACK";
  publisher: string;
  published: number;
  averageSentiment: number;
  reliability: number;
  sentimentMap: Record<string, string>;
  primaryImageUrl: string | null;
}

export interface StoryCluster {
  id: string;
  title: string;
  summarizedContent: string;
  selectedImageUrl: string | null;
  clusterSize: number;
  averageSentiment: number;
  createdAt: number;
}

export interface Story {
  cluster: StoryCluster;
  displayTickers: string[];
  tickers: string[];
  impactScore: number;
  representativeTimestamp: number;
  topDocuments?: Document[];
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
  expanded?: boolean;
  filterHours?: number;
}

export interface GetStoryOptions {
  share?: boolean;
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

// ── Entity Metrics ──────────────────────────────────────────

export interface MentionData {
  [key: string]: unknown;
}

export interface MentionCount {
  [key: string]: unknown;
}

export interface SentimentData {
  [key: string]: unknown;
}

export interface EntityMetricsDateRange {
  startDate?: string;
  endDate?: string;
}

export interface GetMentionsOptions extends EntityMetricsDateRange {
  source?: DocumentSource;
}

export interface GetMentionCountOptions extends EntityMetricsDateRange {
  source?: DocumentSource;
}

export interface GetSentimentBySourceOptions {
  date?: string;
}

// ── Market Mood ─────────────────────────────────────────────

export interface MarketMood {
  [key: string]: unknown;
}

// ── Knowledge Base ──────────────────────────────────────────

export interface KBEntity {
  entityId: string;
  name: string;
  [key: string]: unknown;
}
