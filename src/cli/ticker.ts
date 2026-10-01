import type { SentiSense } from "../client.js";
import { APIError, NotFoundError } from "../errors.js";
import type { EtfQuote } from "../resources/etfs.js";
import type { StockQuote } from "../types.js";
import { CliUsageError, UnknownTickerError } from "./errors.js";
import type { ParsedArgs } from "./parse.js";

/**
 * Argument handling shared by every command that reads one symbol.
 *
 * Two failure modes live here because both are quiet by default and both mislead: a command
 * silently dropping the tickers it cannot use, and an unknown symbol coming back as a
 * plausible empty result.
 */

function rejectSurplus(args: ParsedArgs, name: string, allowed: number): void {
  if (args.positionals.length <= allowed) return;
  throw new CliUsageError(
    `${name} takes one ticker, and got ${args.positionals.length}.`,
    "run it once per ticker. Only quote accepts more than one.",
  );
}

/** The single ticker a command requires, upper-cased. */
export function oneTicker(args: ParsedArgs, name: string): string {
  rejectSurplus(args, name, 1);
  const ticker = args.positionals[0];
  if (!ticker) {
    throw new CliUsageError(
      `${name} needs a ticker.`,
      `for example: sentisense ${name} NVDA`,
    );
  }
  return ticker.toUpperCase();
}

/** The ticker a command will narrow to, or undefined for its market-wide feed. */
export function optionalTicker(args: ParsedArgs, name: string): string | undefined {
  rejectSurplus(args, name, 1);
  return args.positionals[0]?.toUpperCase();
}

/** For commands that read no positional arguments at all. */
export function rejectPositionals(args: ParsedArgs, name: string): void {
  if (args.positionals.length === 0) return;
  throw new CliUsageError(
    `${name} takes no ticker, and got ${args.positionals.length}.`,
    `run "sentisense help ${name}" for what it accepts.`,
  );
}

/**
 * Confirms a symbol exists, for a command that came back empty.
 *
 * Most endpoints answer an unknown symbol with `200` and nothing in it, which is
 * indistinguishable from a real company that simply had no filings in the window. Reporting
 * both as "no data" hands back a confident-looking answer to a typo. One quote lookup settles
 * it, and it only ever runs on the empty path, so a command that found something still costs
 * exactly what it did before.
 *
 * Throws when the symbol does not exist. Returns a note when the check itself could not be
 * completed, since a failed verification is not evidence either way and must not turn an
 * answered command into a failure.
 */
export async function verifyTickerOnEmpty(
  api: SentiSense,
  ticker: string,
): Promise<string | undefined> {
  try {
    await api.stocks.getQuote(ticker);
    return undefined;
  } catch (error) {
    // An ETF is refused by the stock quote with this code, which is itself proof the symbol
    // exists, so no second request is spent.
    if (isEtfRedirect(error)) return undefined;
    if (error instanceof NotFoundError) throw new UnknownTickerError(ticker);
    return `could not verify ${ticker}, so the empty result is unconfirmed`;
  }
}

/** True for the error the stock quote answers an ETF symbol with. */
export function isEtfRedirect(error: unknown): boolean {
  return error instanceof APIError && error.code === "ticker_is_etf";
}

/** A quote for either kind of symbol, tagged with the endpoint that answered it. */
export type AnyQuote =
  | { kind: "stock"; quote: StockQuote }
  | { kind: "etf"; quote: EtfQuote };

/**
 * The quote for a stock or an ETF.
 *
 * The stock quote refuses an ETF symbol with `ticker_is_etf` rather than answering it, so
 * that one error is retried against the ETF quote. Every other outcome is the stock
 * quote's own, which keeps a stock symbol at exactly one request.
 */
export async function quoteAnyTicker(api: SentiSense, ticker: string): Promise<AnyQuote> {
  try {
    return { kind: "stock", quote: await api.stocks.getQuote(ticker) };
  } catch (error) {
    if (!isEtfRedirect(error)) throw error;
    return { kind: "etf", quote: await api.etfs.quote(ticker) };
  }
}

/** Help line every command using the check above carries, so the extra call is not a surprise. */
export const EMPTY_VERIFY_NOTE =
  "An empty result verifies the ticker before reporting no data, so a typo exits 4 rather";
export const EMPTY_VERIFY_NOTE_2 = "than looking like a company with nothing to report.";
