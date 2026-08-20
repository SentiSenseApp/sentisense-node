import {
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  SentiSenseError,
} from "../errors.js";

/**
 * Exit codes.
 *
 * The point of having six instead of one is that a script can branch without parsing prose:
 * 3 means fix your key, 5 means back off and retry, 4 means the symbol is wrong.
 */
export const EXIT = {
  OK: 0,
  ERROR: 1,
  USAGE: 2,
  AUTH: 3,
  NOT_FOUND: 4,
  RATE_LIMIT: 5,
  NETWORK: 6,
} as const;

export const EXIT_TABLE: Array<[number, string]> = [
  [EXIT.OK, "success"],
  [EXIT.ERROR, "API error or unexpected failure"],
  [EXIT.USAGE, "bad usage: unknown command, flag, or missing argument"],
  [EXIT.AUTH, "missing or rejected API key"],
  [EXIT.NOT_FOUND, "no data for that symbol or identifier"],
  [EXIT.RATE_LIMIT, "rate limited"],
  [EXIT.NETWORK, "network failure or timeout"],
];

export const KEY_URL = "https://app.sentisense.ai/get-api-key";

/** A mistake in how the command was invoked. Never reaches the network. */
export class CliUsageError extends Error {
  hint?: string;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = "CliUsageError";
    this.hint = hint;
  }
}

/**
 * A symbol the API does not know.
 *
 * Distinct from {@link NotFoundError} because it is something the CLI concluded rather than
 * something the server said: most endpoints answer an unknown symbol with an empty `200`, so
 * this is raised after a verification lookup on an empty result.
 */
export class UnknownTickerError extends Error {
  ticker: string;

  constructor(ticker: string) {
    super(`unknown ticker "${ticker}".`);
    this.name = "UnknownTickerError";
    this.ticker = ticker;
  }
}

/** No key was resolved from a flag, the environment, or the config file. */
export class MissingKeyError extends Error {
  constructor() {
    super("no API key configured.");
    this.name = "MissingKeyError";
  }
}

export interface ErrorReport {
  exitCode: number;
  lines: string[];
}

/**
 * One line saying what went wrong, one saying what to do about it.
 *
 * Both go to stderr, so a caller piping stdout still gets clean output or clean JSON.
 */
export function describeError(error: unknown, debug: boolean): ErrorReport {
  const report = classify(error);
  if (debug && error instanceof Error && error.stack) {
    report.lines.push(error.stack);
  }
  return report;
}

function classify(error: unknown): ErrorReport {
  if (error instanceof MissingKeyError) {
    return {
      exitCode: EXIT.AUTH,
      lines: [
        "error: no API key configured.",
        `next: run "sentisense auth <key>", or set SENTISENSE_API_KEY. Get a key at ${KEY_URL}`,
      ],
    };
  }

  if (error instanceof UnknownTickerError) {
    return {
      exitCode: EXIT.NOT_FOUND,
      lines: [
        `error: ${error.message}`,
        "next: check the symbol. Use canonical tickers, for example GOOGL rather than GOOG and BRK.B rather than BRK-B.",
      ],
    };
  }

  if (error instanceof CliUsageError) {
    return {
      exitCode: EXIT.USAGE,
      lines: [
        `error: ${error.message}`,
        `next: ${error.hint ?? 'run "sentisense --help" for the command list.'}`,
      ],
    };
  }

  if (error instanceof AuthenticationError) {
    return {
      exitCode: EXIT.AUTH,
      lines: [
        `error: the API key was rejected (${error.status ?? 401}): ${error.message}`,
        `next: check the stored key with "sentisense auth", or get a new one at ${KEY_URL}`,
      ],
    };
  }

  if (error instanceof NotFoundError) {
    return {
      exitCode: EXIT.NOT_FOUND,
      lines: [
        `error: not found: ${error.message}`,
        'next: check the symbol. Use canonical tickers, for example GOOGL rather than GOOG.',
      ],
    };
  }

  if (error instanceof RateLimitError) {
    const wait = error.retryAfter ? Math.ceil(error.retryAfter) : 60;
    return {
      exitCode: EXIT.RATE_LIMIT,
      lines: [
        `error: rate limited: ${error.message}`,
        `next: wait ${wait} seconds and run it again. The CLI does not retry for you.`,
      ],
    };
  }

  if (error instanceof SentiSenseError) {
    // The client wraps a failed fetch and an aborted request in a bare error with no status,
    // which is the only reliable way to tell "never got a response" from "got a bad one".
    if (error.status === undefined) {
      return {
        exitCode: EXIT.NETWORK,
        lines: [
          `error: could not reach the API: ${error.message}`,
          'next: check the network and the base URL, then run "sentisense health".',
        ],
      };
    }
    return {
      exitCode: EXIT.ERROR,
      lines: [
        `error: request failed (${error.status}): ${error.message}`,
        'next: run "sentisense health" to check the service, then try again.',
      ],
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    exitCode: EXIT.ERROR,
    lines: [
      `error: ${message}`,
      "next: run the same command with --debug for the stack trace.",
    ],
  };
}
