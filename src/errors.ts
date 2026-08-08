export class SentiSenseError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "SentiSenseError";
    this.status = status;
    this.code = code;
  }
}

export class AuthenticationError extends SentiSenseError {
  constructor(message: string, status: number, code?: string) {
    super(message, status, code);
    this.name = "AuthenticationError";
  }
}

export class NotFoundError extends SentiSenseError {
  constructor(message: string, code?: string) {
    super(message, 404, code);
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

export class RateLimitError extends SentiSenseError {
  /**
   * Seconds to wait before retrying, from the server's `Retry-After` header, clamped to
   * `[0.5, 120]`. Always either a finite number or `undefined`: an absent header, or one
   * carrying an HTTP-date instead of a number of seconds, leaves it undefined rather than
   * `NaN`, so `setTimeout(fn, err.retryAfter * 1000)` can never fire immediately.
   */
  retryAfter?: number;

  constructor(message: string, code?: string, retryAfter?: number) {
    super(message, 429, code);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class APIError extends SentiSenseError {
  constructor(message: string, status: number, code?: string) {
    super(message, status, code);
    this.name = "APIError";
  }
}
