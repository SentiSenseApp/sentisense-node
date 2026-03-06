export { SentiSense } from "./client.js";
export { SentiSense as default } from "./client.js";

export {
  SentiSenseError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  APIError,
} from "./errors.js";

export type {
  SentiSenseOptions,
  StockPrice,
  StockDetail,
  StockImage,
  StockProfile,
  StockEntity,
  ChartData,
  ChartDataPoint,
  MarketStatus,
  Fundamentals,
  FundamentalsPeriod,
  ShortInterest,
  FloatInfo,
  ShortVolume,
  AISummary,
  MetricsBreakdown,
  Document,
  DocumentSource,
  Story,
  StoryCluster,
  Quarter,
  InstitutionalFlow,
  Holder,
  MentionData,
  MentionCount,
  SentimentData,
  MarketMood,
  KBEntity,
} from "./types.js";

export { VERSION } from "./version.js";
