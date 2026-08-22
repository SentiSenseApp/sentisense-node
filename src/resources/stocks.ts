import type { APIClient } from "../client.js";
import type {
  AISummary,
  ChartData,
  ChartDataPoint,
  CompanyKpisData,
  FloatInfo,
  Fundamentals,
  FundamentalsPeriodsResponse,
  TtmFundamentals,
  GetAISummaryOptions,
  GetChartOptions,
  GetDescriptionsOptions,
  GetFundamentalsOptions,
  GetImagesOptions,
  GetMetricsBreakdownOptions,
  GetProfileOptions,
  GetOptionsHistoryOptions,
  GetSimilarOptions,
  KpiCoverageResponse,
  KpiTypeEntry,
  MarketStatus,
  MetricsBreakdown,
  OptionsHistory,
  OptionsSummary,
  PreviewResponse,
  SimilarStock,
  ShortInterest,
  ShortVolume,
  StockDetail,
  StockEntity,
  StockSentiment,
  StockImage,
  StockPrice,
  StockProfile,
  StockQuote,
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

  /**
   * Get aggregate quote snapshot: live price, today OHLC, 52-week range,
   * market cap, P/E, EPS TTM, and dividend yield in a single call.
   * All fields except `ticker` may be null when upstream data is unavailable.
   */
  async getQuote(ticker: string): Promise<StockQuote> {
    return this.client.get(`/api/v1/stocks/${encodeURIComponent(ticker)}/quote`);
  }

  /** Get real-time prices for multiple tickers. */
  async getPrices(tickers: string[]): Promise<StockPrice[]> {
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
  async getSimilar(ticker: string, options?: GetSimilarOptions): Promise<SimilarStock[]> {
    return this.client.get(`/api/v1/stocks/${encodeURIComponent(ticker)}/similar`, options);
  }

  /** Get company profile (CEO, sector, industry, market data). */
  async getProfile(ticker: string, options?: GetProfileOptions): Promise<StockProfile> {
    return this.client.get(`/api/v1/stocks/${encodeURIComponent(ticker)}/profile`, options);
  }

  /**
   * Get the headline sentiment picture for a stock in one call.
   *
   * Returns the SentiSense Score with its 30-day regime, mention volume and social
   * dominance, per-source tone in `bySource`, plus related tickers, story drivers, a
   * narrative and an FAQ. Available in full on every API-key tier.
   *
   * Use `entityMetrics.getMetrics(ticker, "sentiment", ...)` instead when you need a time
   * series over a specific window rather than the headline read. Returns 404 for tickers
   * with no sentiment coverage.
   */
  async getSentiment(ticker: string): Promise<PreviewResponse<StockSentiment>> {
    return this.client.get(
      `/api/v1/stocks/${encodeURIComponent(ticker)}/sentiment`,
    );
  }

  /** Get related KB entities (people, products, partners). */
  async getEntities(ticker: string): Promise<StockEntity[]> {
    return this.client.get(`/api/v1/stocks/${encodeURIComponent(ticker)}/entities`);
  }

  /**
   * Get AI-generated stock analysis report. Requires PRO tier.
   *
   * `depth: "deep"` returns the full curated report and consumes one report view on
   * metered tiers; the default `"basic"` returns the one-paragraph summary.
   *
   * The deprecated `forceRefresh` option is accepted and discarded, not forwarded.
   */
  async getAISummary(ticker: string, options?: GetAISummaryOptions): Promise<AISummary> {
    const { forceRefresh: _forceRefresh, ...params } = options ?? {};
    return this.client.get(`/api/v1/stocks/${encodeURIComponent(ticker)}/ai-summary`, params);
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

  /**
   * Get historical OHLCV chart data.
   *
   * The API returns a bare array of points; this normalizes it to
   * `{ ticker, timeframe, data }`. `timeframe` echoes the requested value
   * (defaulting to "1M", matching the server default when omitted).
   */
  async getChart(ticker: string, options?: GetChartOptions): Promise<ChartData> {
    const data = await this.client.get<ChartDataPoint[]>("/api/v1/stocks/chart", {
      ticker,
      ...options,
    });
    return { ticker, timeframe: options?.timeframe ?? "1M", data };
  }

  /** Get current market open/closed/pre-market/after-hours status. */
  async getMarketStatus(): Promise<MarketStatus> {
    return this.client.get("/api/v1/stocks/market-status");
  }

  /**
   * Get financial statement data for one reporting period: income statement, balance sheet,
   * and cash flow, including `capitalExpenditure` and `freeCashFlow`.
   *
   * Capital expenditure is signed as filed, so normally negative. See {@link Fundamentals}
   * for the free-cash-flow relationship and when it is `null`.
   */
  async getFundamentals(ticker: string, options?: GetFundamentalsOptions): Promise<Fundamentals> {
    return this.client.get("/api/v1/stocks/fundamentals", { ticker, ...options });
  }

  /** Get available fiscal periods. The periods are in `periods`. */
  async getFundamentalsPeriods(ticker: string): Promise<FundamentalsPeriodsResponse> {
    return this.client.get("/api/v1/stocks/fundamentals/periods", { ticker });
  }

  /**
   * Get the trailing-twelve-month fundamentals snapshot: TTM ratios, a different
   * shape from the per-period statement data `getFundamentals()` returns.
   */
  async getCurrentFundamentals(ticker: string): Promise<TtmFundamentals> {
    return this.client.get("/api/v1/stocks/fundamentals/current", { ticker });
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

  /**
   * Get company-specific KPI time-series for a ticker. Returns curated GAAP and
   * non-GAAP metrics from earnings filings (e.g. iPhone unit sales, Tesla deliveries,
   * AWS revenue).
   *
   * Free users receive metadata only with an empty `kpis` list; PRO users receive
   * the full series. Returns 404 for tickers that do not yet have curated coverage.
   *
   * Coverage today: near-complete for the S&P 500 plus extended universe
   * (~500 tickers). Use `listKpiCoverage()` to enumerate.
   */
  async getKpis(ticker: string): Promise<PreviewResponse<CompanyKpisData>> {
    return this.client.get(
      `/api/v1/stocks/${encodeURIComponent(ticker.toUpperCase())}/kpis`,
    );
  }

  /**
   * List every ticker with curated KPI coverage. Returns `{count, tickers: [...]}`
   * with lightweight metadata (ticker, companyName, lastUpdated, kpiCount).
   * Sorted alphabetically by ticker.
   *
   * Auth: API key required, but the call does NOT consume your monthly quota
   * (rate-limit-per-minute still applies).
   */
  async listKpiCoverage(): Promise<KpiCoverageResponse> {
    return this.client.get("/api/v1/stocks/with-kpis");
  }

  /**
   * List the KPI metadata tuples available for a ticker (`id, name, category,
   * chartType`) without paying the cost of the full series payload. Mirrors
   * the `/api/v1/insights/stock/{ticker}/types` precedent.
   *
   * Auth: API key required, no quota cost. 404 if the ticker has no curated KPIs.
   */
  async getKpiTypes(ticker: string): Promise<KpiTypeEntry[]> {
    return this.client.get(
      `/api/v1/stocks/${encodeURIComponent(ticker.toUpperCase())}/kpis/types`,
    );
  }

  /**
   * Get the end-of-day options dossier for one stock or ETF: the session's aggregate, its
   * percentile context, the open-interest wall structure with max pain, and the contracts
   * whose volume ran far ahead of their open interest.
   *
   * End of day, not live. `asOf` is the prior trading session and the data refreshes the
   * following morning, so this is positioning, not a quote feed.
   *
   * **`data` is `null` for a ticker outside the covered universe**, which is the most
   * actively optioned US names plus the tracked ETFs, and for a covered ticker with no
   * snapshot yet. An unknown symbol behaves the same way rather than answering 404, so treat
   * a null as "no coverage", never as an error. A covered ticker still building its baseline
   * returns its raw readings with the percentiles omitted.
   *
   * Percentiles compare a ticker to its own trailing history, never to another ticker, so an
   * ETF's readings are not comparable with a single stock's.
   *
   * Tiering: a PRO key always receives the full dossier. A FREE key receives it for the first
   * ten calls each calendar month and a headline-only preview after that, with `isPreview`
   * true; calls that return a null `data` never spend that allowance.
   */
  async getOptionsSummary(ticker: string): Promise<PreviewResponse<OptionsSummary | null>> {
    return this.client.get(
      `/api/v1/stocks/${encodeURIComponent(ticker.toUpperCase())}/options/summary`,
    );
  }

  /**
   * Get the daily options aggregates for one stock or ETF as a time series, oldest first.
   * Use it to chart how a reading has trended: implied volatility, put/call flow, skew.
   *
   * Each element has the same shape as the dossier's `latest` aggregate, so a chart built
   * off `getOptionsSummary` reads this series without a second mapping.
   *
   * **A null payload is not how this one reports no coverage.** Unlike
   * {@link Stocks.getOptionsSummary}, an uncovered ticker, an unknown symbol and a covered
   * ticker with nothing stored yet all answer with a populated object whose `series` is
   * empty. Check the array's length, not the payload.
   *
   * The window served is not always the window requested: an unrecognised value clamps to
   * `"1y"` rather than erroring, and a FREE key always receives `"1y"`. Read `data.window`
   * for what you actually got. `"5y"` means all stored history, currently a little over two
   * years, so it can answer with nearly the same series as `"2y"`.
   */
  async getOptionsHistory(
    ticker: string,
    options?: GetOptionsHistoryOptions,
  ): Promise<PreviewResponse<OptionsHistory>> {
    return this.client.get(
      `/api/v1/stocks/${encodeURIComponent(ticker.toUpperCase())}/options/history`,
      options,
    );
  }
}
