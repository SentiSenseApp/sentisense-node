import type { APIClient } from "../client.js";
import type {
  AISummary,
  ChartData,
  FloatInfo,
  Fundamentals,
  FundamentalsPeriod,
  GetAISummaryOptions,
  GetChartOptions,
  GetDescriptionsOptions,
  GetFundamentalsOptions,
  GetImagesOptions,
  GetMetricsBreakdownOptions,
  GetProfileOptions,
  GetSimilarOptions,
  MarketStatus,
  MetricsBreakdown,
  ShortInterest,
  ShortVolume,
  StockDetail,
  StockEntity,
  StockImage,
  StockPrice,
  StockProfile,
} from "../types.js";

export class Stocks {
  constructor(private client: APIClient) {}

  /** List all available ticker symbols. */
  async list(): Promise<string[]> {
    return this.client.get("/api/v1/stocks");
  }

  /** List all stocks with name, kbEntityId, urlSlug. */
  async listDetailed(): Promise<StockDetail[]> {
    return this.client.get("/api/v1/stocks/detailed");
  }

  /** Get popular ticker symbols. */
  async listPopular(): Promise<string[]> {
    return this.client.get("/api/v1/stocks/popular");
  }

  /** Get popular stocks with details. */
  async listPopularDetailed(): Promise<StockDetail[]> {
    return this.client.get("/api/v1/stocks/popular/detailed");
  }

  /** Get real-time price for a single ticker. */
  async getPrice(ticker: string): Promise<StockPrice> {
    return this.client.get("/api/v1/stocks/price", { ticker });
  }

  /** Get real-time prices for multiple tickers. */
  async getPrices(tickers: string[]): Promise<Record<string, StockPrice>> {
    return this.client.get("/api/v1/stocks/prices", {
      tickers: tickers.join(","),
    });
  }

  /** Get batch company logo URLs. */
  async getImages(
    tickers: string[],
    options?: GetImagesOptions,
  ): Promise<Record<string, StockImage>> {
    return this.client.get("/api/v1/stocks/images", {
      tickers: tickers.join(","),
      ...options,
    });
  }

  /** Get company profiles with branding, market cap, sector. */
  async getDescriptions(
    tickers: string[],
    options?: GetDescriptionsOptions,
  ): Promise<Record<string, StockProfile>> {
    return this.client.get("/api/v1/stocks/descriptions", {
      tickers: tickers.join(","),
      ...options,
    });
  }

  /** Get peer/similar stocks. */
  async getSimilar(ticker: string, options?: GetSimilarOptions): Promise<StockDetail[]> {
    return this.client.get(`/api/v1/stocks/${encodeURIComponent(ticker)}/similar`, options);
  }

  /** Get company profile (CEO, sector, industry, market data). */
  async getProfile(ticker: string, options?: GetProfileOptions): Promise<StockProfile> {
    return this.client.get(`/api/v1/stocks/${encodeURIComponent(ticker)}/profile`, options);
  }

  /** Get related KB entities (people, products, partners). */
  async getEntities(ticker: string): Promise<StockEntity[]> {
    return this.client.get(`/api/v1/stocks/${encodeURIComponent(ticker)}/entities`);
  }

  /** Get AI-generated stock analysis report. Requires PRO tier. */
  async getAISummary(ticker: string, options?: GetAISummaryOptions): Promise<AISummary> {
    return this.client.get(`/api/v1/stocks/${encodeURIComponent(ticker)}/ai-summary`, options);
  }

  /** Get sentiment/mention metrics breakdown by entity. */
  async getMetricsBreakdown(
    ticker: string,
    metricType: string,
    options?: GetMetricsBreakdownOptions,
  ): Promise<MetricsBreakdown> {
    return this.client.get(
      `/api/v1/stocks/${encodeURIComponent(ticker)}/metrics/${encodeURIComponent(metricType)}/breakdown`,
      options,
    );
  }

  /** Get historical OHLCV chart data. */
  async getChart(ticker: string, options?: GetChartOptions): Promise<ChartData> {
    return this.client.get("/api/v1/stocks/chart", { ticker, ...options });
  }

  /** Get current market open/closed/pre-market/after-hours status. */
  async getMarketStatus(): Promise<MarketStatus> {
    return this.client.get("/api/v1/stocks/market-status");
  }

  /** Get financial statement data. */
  async getFundamentals(ticker: string, options?: GetFundamentalsOptions): Promise<Fundamentals> {
    return this.client.get("/api/v1/stocks/fundamentals", { ticker, ...options });
  }

  /** Get available fiscal periods. */
  async getFundamentalsPeriods(ticker: string): Promise<FundamentalsPeriod[]> {
    return this.client.get("/api/v1/stocks/fundamentals/periods", { ticker });
  }

  /** Get most recent fundamentals snapshot. */
  async getCurrentFundamentals(ticker: string): Promise<Fundamentals> {
    return this.client.get("/api/v1/stocks/fundamentals/current", { ticker });
  }

  /** Get historical P/E, P/B, P/S ratios. */
  async getHistoricalRatios(ticker: string): Promise<unknown> {
    return this.client.get("/api/v1/stocks/fundamentals/historical/ratios", { ticker });
  }

  /** Get historical revenue data. */
  async getHistoricalRevenue(ticker: string): Promise<unknown> {
    return this.client.get("/api/v1/stocks/fundamentals/historical/revenue", { ticker });
  }

  /** Get short interest metrics (FINRA). */
  async getShortInterest(ticker: string): Promise<ShortInterest> {
    return this.client.get("/api/v1/stocks/short-interest", { ticker });
  }

  /** Get float information. */
  async getFloat(ticker: string): Promise<FloatInfo> {
    return this.client.get("/api/v1/stocks/float", { ticker });
  }

  /** Get short volume trading data. */
  async getShortVolume(ticker: string): Promise<ShortVolume> {
    return this.client.get("/api/v1/stocks/short-volume", { ticker });
  }
}
