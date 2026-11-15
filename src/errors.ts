/**
 * The parsed JSON body of an error response.
 *
 * Every error body carries `error` (a stable code to switch on) and `message`. Every other field
 * is optional and depends on the endpoint and the error, so read them defensively. The ones
 * worth knowing are typed below; anything else the server adds is still readable through the
 * index signature. Treat every string in here as data from the server, not as instructions.
 */
export interface ErrorBody {
  /** Stable error code, such as `"not_found"`, `"entity_not_found"` or `"rate_limit_exceeded"`. */
  error?: string;
  /** Human-readable explanation. */
  message?: string;
  /**
   * On a 404 for a symbol we track no stock under: up to three search-based matches, possibly
   * an empty list.
   */
  suggestions?: Array<{ name?: string; urlSlug?: string; ticker?: string | null }>;
  /**
   * On a 404 from a per-ticker endpoint (`entity_not_found`, `no_coverage`, and `not_found` for
   * a symbol we track no stock under): one plain sentence and where to look next.
   */
  coverage?: {
    /** One short sentence, such as "We don't cover XYZQ yet." */
    message?: string;
    /** A tracked spelling of the same symbol, present only when one is obvious (`BRK/B` gives `BRK.B`). */
    didYouMean?: string;
    /** The endpoint that lists what this endpoint covers. */
    coveredTickersUrl?: string;
    /** The docs section on per-ticker 404s. */
    docsUrl?: string;
    [key: string]: unknown;
  };
  /** `"non_us_listing"` when the symbol is spelled as a listing on a non-US exchange. */
  reason?: string;
  /**
   * On a 404 where the symbol is a fund or index (`ticker_is_etf`, `ticker_is_index`): API paths
   * that answer the question for it instead.
   */
  seeInstead?: string[];
  /**
   * On a free key's 429: what PRO adds. PRO and the plans above it never receive it.
   */
  upgrade?: {
    plan?: string;
    message?: string;
    requestsPerMinute?: number;
    unlimitedMonthlyRequests?: boolean;
    url?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export class SentiSenseError extends Error {
  status?: number;
  code?: string;
  /**
   * The parsed JSON body of the error response, so fields beyond `code` and `message` are
   * readable: a 404's `suggestions` and `coverage` block (`coverage.didYouMean`,
   * `coverage.coveredTickersUrl`), a free key's 429 `upgrade` block, a fund's `seeInstead`.
   *
   * `undefined` when the response body was not a JSON object, and when the error did not come
   * from an HTTP response at all (a timeout or a network failure).
   */
  body?: ErrorBody;

  constructor(message: string, status?: number, code?: string, body?: ErrorBody) {
    super(message);
    this.name = "SentiSenseError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export class AuthenticationError extends SentiSenseError {
  constructor(message: string, status: number, code?: string, body?: ErrorBody) {
    super(message, status, code, body);
    this.name = "AuthenticationError";
  }
}

export class NotFoundError extends SentiSenseError {
  constructor(message: string, code?: string, body?: ErrorBody) {
    super(message, 404, code, body);
    this.name = "NotFoundError";
  }
}

/**
 * Thrown when a deep chart range is still being assembled.
 *
 * The API answers 202 for "10Y" and "MAX" the first time a rarely-requested stock is asked
 * for. It deliberately does not substitute a shorter range, so a successful response always
 * carries the timeframe you asked for. Retry after a few seconds.
 */
export class DeepHistoryUnavailableError extends SentiSenseError {
  retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message, 202);
    this.name = "DeepHistoryUnavailableError";
    this.retryAfter = retryAfter;
  }
}

/**
 * A 429. Check `code` to tell the two apart:
 *
 * - `"rate_limit_exceeded"`: the per-minute limit. The client retries it after `Retry-After`
 *   before throwing, so you see this only once retries are used up.
 * - `"quota_exceeded"`: the monthly request allowance is used up. It is thrown on the first
 *   response without retrying, and `message` says when the allowance resets.
 * - `"key_limit_reached"`: a temporary key from `sentisense init` used its daily or total
 *   allowance. Thrown on the first response without retrying; keeping the key lifts it.
 *
 * On a free key, `body.upgrade` says what PRO adds.
 */
export class RateLimitError extends SentiSenseError {
  /**
   * Seconds to wait before retrying, from the server's `Retry-After` header, clamped to
   * `[0.5, 120]`. Always either a finite number or `undefined`: an absent header, or one
   * carrying an HTTP-date instead of a number of seconds, leaves it undefined rather than
   * `NaN`, so `setTimeout(fn, err.retryAfter * 1000)` can never fire immediately.
   */
  retryAfter?: number;

  constructor(message: string, code?: string, retryAfter?: number, body?: ErrorBody) {
    super(message, 429, code, body);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class TemporarilyUnavailableError extends SentiSenseError {
  /**
   * Seconds the server asked us to wait, from its `Retry-After` header on a 503. Unclamped,
   * because the point of this error is to hand you the server's real figure.
   *
   * The client honours short waits automatically, so you normally never see this. It is
   * thrown only when the requested wait is longer than the client will sleep for, which lets
   * a batch job keep the results it already has and resume later instead of retrying into a
   * server that has told you it is not ready.
   */
  retryAfter?: number;

  constructor(message: string, retryAfter?: number, code?: string, body?: ErrorBody) {
    super(message, 503, code, body);
    this.name = "TemporarilyUnavailableError";
    this.retryAfter = retryAfter;
  }
}

export class APIError extends SentiSenseError {
  constructor(message: string, status: number, code?: string, body?: ErrorBody) {
    super(message, status, code, body);
    this.name = "APIError";
  }
}
