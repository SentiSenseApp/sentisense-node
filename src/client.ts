import {
  APIError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  SentiSenseError,
} from "./errors.js";
import { Documents } from "./resources/documents.js";
import { EntityMetrics } from "./resources/entityMetrics.js";
import { Insider } from "./resources/insider.js";
import { Insights } from "./resources/insights.js";
import { Institutional } from "./resources/institutional.js";
import { KB } from "./resources/kb.js";
import { MarketMoodResource } from "./resources/marketMood.js";
import { MarketSummaryResource } from "./resources/marketSummary.js";
import { Stocks } from "./resources/stocks.js";
import type { SentiSenseOptions } from "./types.js";
import { VERSION } from "./version.js";

const DEFAULT_BASE_URL = "https://app.sentisense.ai";
const DEFAULT_TIMEOUT = 30_000;

/** @internal HTTP interface exposed to resource classes. */
export interface APIClient {
  get<T = unknown>(path: string, params?: object): Promise<T>;
}

export class SentiSense implements APIClient {
  private baseUrl: string;
  private apiKey: string | undefined;
  private timeout: number;

  readonly stocks: Stocks;
  readonly documents: Documents;
  readonly institutional: Institutional;
  readonly insider: Insider;
  readonly insights: Insights;
  readonly entityMetrics: EntityMetrics;
  readonly marketMood: MarketMoodResource;
  readonly marketSummary: MarketSummaryResource;
  readonly kb: KB;

  constructor(options: SentiSenseOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;

    this.stocks = new Stocks(this);
    this.documents = new Documents(this);
    this.institutional = new Institutional(this);
    this.insider = new Insider(this);
    this.insights = new Insights(this);
    this.entityMetrics = new EntityMetrics(this);
    this.marketMood = new MarketMoodResource(this);
    this.marketSummary = new MarketSummaryResource(this);
    this.kb = new KB(this);
  }

  /** @internal */
  async get<T = unknown>(path: string, params?: object): Promise<T> {
    const url = this.buildUrl(path, params);
    const headers: Record<string, string> = {
      "Accept": "application/json",
    };

    if (this.apiKey) {
      headers["X-SentiSense-API-Key"] = this.apiKey;
    }

    // User-Agent is only set in Node.js (browsers disallow it)
    if (typeof process !== "undefined" && process.versions?.node) {
      headers["User-Agent"] = `sentisense-node/${VERSION}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof SentiSenseError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new SentiSenseError(`Request timed out after ${this.timeout}ms`);
      }
      throw new SentiSenseError(
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private buildUrl(path: string, params?: object): string {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let body: { error?: string; message?: string } = {};
    try {
      body = await response.json();
    } catch {
      // Response may not be JSON
    }

    const message = body.message ?? response.statusText ?? "API request failed";
    const code = body.error;

    switch (response.status) {
      case 401:
      case 403:
        throw new AuthenticationError(message, response.status, code);
      case 404:
        throw new NotFoundError(message, code);
      case 429:
        throw new RateLimitError(message, code);
      default:
        throw new APIError(message, response.status, code);
    }
  }
}
