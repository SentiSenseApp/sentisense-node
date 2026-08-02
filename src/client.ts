import {
  APIError,
  AuthenticationError,
  DeepHistoryUnavailableError,
  NotFoundError,
  RateLimitError,
  SentiSenseError,
} from "./errors.js";
import { Analyst } from "./resources/analyst.js";
import { Calendar } from "./resources/calendar.js";
import { Documents } from "./resources/documents.js";
import { EntityMetrics } from "./resources/entityMetrics.js";
import { Etfs } from "./resources/etfs.js";
import { Insider } from "./resources/insider.js";
import { Politicians } from "./resources/politicians.js";
import { Insights } from "./resources/insights.js";
import { Institutional } from "./resources/institutional.js";
import { KB } from "./resources/kb.js";
import { MarketMoodResource } from "./resources/marketMood.js";
import { MarketSummaryResource } from "./resources/marketSummary.js";
import { Stocks } from "./resources/stocks.js";
import { Trackers } from "./resources/trackers.js";
import type { SentiSenseOptions } from "./types.js";
import { VERSION } from "./version.js";

const DEFAULT_BASE_URL = "https://app.sentisense.ai";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 60_000;
// Used when a 202 arrives without a usable Retry-After header.
const DEEP_HISTORY_FALLBACK_WAIT_S = 3;

// Upper bounds on any server-supplied Retry-After. Rate limiting gets the longer ceiling
// because a genuine limit window is legitimately minutes, while a deep-history warm-up is
// seconds. Without a ceiling an oversized header value strands the caller indefinitely.
const MAX_DEEP_HISTORY_WAIT_S = 30;
const MAX_RATE_LIMIT_WAIT_S = 120;
const RATE_LIMIT_FALLBACK_WAIT_S = 60;

/**
 * Seconds to wait before retrying, from a `Retry-After` header.
 *
 * Clamped to `[0.5, maxWaitS]`. `Retry-After` may legally carry an HTTP-date rather than a
 * number of seconds, in which case `parseInt` yields `NaN`; left unguarded that produced a
 * `NaN` delay which compared false against every threshold and retried instantly in a busy
 * loop. Anything that is not a finite number falls back to `defaultS`.
 */
function retryAfterSeconds(
  raw: string | null,
  defaultS: number,
  maxWaitS: number,
): number {
  if (!raw) return defaultS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return defaultS;
  return Math.min(Math.max(0.5, parsed), maxWaitS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** @internal HTTP interface exposed to resource classes. */
export interface APIClient {
  get<T = unknown>(path: string, params?: object): Promise<T>;
  post<T = unknown>(path: string, body: unknown): Promise<T>;
}

export class SentiSense implements APIClient {
  private baseUrl: string;
  private apiKey: string | undefined;
  private timeout: number;
  private maxRetries: number;

  readonly stocks: Stocks;
  readonly documents: Documents;
  readonly etfs: Etfs;
  readonly institutional: Institutional;
  readonly insider: Insider;
  readonly politicians: Politicians;
  readonly insights: Insights;
  readonly analyst: Analyst;
  readonly entityMetrics: EntityMetrics;
  readonly marketMood: MarketMoodResource;
  readonly marketSummary: MarketSummaryResource;
  readonly kb: KB;
  readonly trackers: Trackers;
  readonly calendar: Calendar;

  constructor(options: SentiSenseOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

    this.stocks = new Stocks(this);
    this.documents = new Documents(this);
    this.etfs = new Etfs(this);
    this.institutional = new Institutional(this);
    this.insider = new Insider(this);
    this.politicians = new Politicians(this);
    this.insights = new Insights(this);
    this.analyst = new Analyst(this);
    this.entityMetrics = new EntityMetrics(this);
    this.marketMood = new MarketMoodResource(this);
    this.marketSummary = new MarketSummaryResource(this);
    this.kb = new KB(this);
    this.trackers = new Trackers(this);
    this.calendar = new Calendar(this);
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

    let delayMs = 0;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (delayMs > 0) {
        await sleep(delayMs);
        delayMs = 0;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(url, {
          method: "GET",
          headers,
          signal: controller.signal,
        });

        // 202 means a deep chart range is still being built server-side. It is a 2xx, so
        // without this it would fall through and return an empty array: the caller would
        // see "no data" rather than "not ready yet", which is the exact confusion the
        // status code exists to prevent. Retry honouring Retry-After, then surface it.
        if (response.status === 202) {
          const waitSeconds = retryAfterSeconds(
            response.headers.get("Retry-After"),
            DEEP_HISTORY_FALLBACK_WAIT_S,
            MAX_DEEP_HISTORY_WAIT_S,
          );
          try { await response.body?.cancel(); } catch { /* ignore */ }
          if (attempt < this.maxRetries) {
            delayMs = waitSeconds * 1000;
            continue;
          }
          throw new DeepHistoryUnavailableError(
            "Deep history is still being assembled. Retry in a few seconds.",
            waitSeconds,
          );
        }

        if (!response.ok) {
          const isRetryable = response.status === 429 || response.status >= 500;
          if (isRetryable && attempt < this.maxRetries) {
            if (response.status === 429) {
              delayMs = retryAfterSeconds(
                response.headers.get("Retry-After"),
                RATE_LIMIT_FALLBACK_WAIT_S,
                MAX_RATE_LIMIT_WAIT_S,
              ) * 1000;
            } else {
              delayMs = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS) + Math.random() * 1000;
            }
            try { await response.body?.cancel(); } catch { /* ignore */ }
            continue;
          }
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

    throw new SentiSenseError("All retries exhausted");
  }

  /** @internal */
  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    const headers: Record<string, string> = {
      "Accept": "application/json",
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["X-SentiSense-API-Key"] = this.apiKey;
    }

    if (typeof process !== "undefined" && process.versions?.node) {
      headers["User-Agent"] = `sentisense-node/${VERSION}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
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
      case 429: {
        const ra = response.headers.get("Retry-After");
        throw new RateLimitError(message, code, ra ? parseInt(ra, 10) : undefined);
      }
      default:
        throw new APIError(message, response.status, code);
    }
  }
}
