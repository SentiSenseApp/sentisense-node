import type { StockProfile } from "../../types.js";
import type { CommandDef, CommandResult } from "../command.js";
import { CliUsageError, describeError } from "../errors.js";
import { quoteAnyTicker, type AnyQuote } from "../ticker.js";
import { cell, doc, field, fields, type Block } from "../render/doc.js";
import {
  direction,
  fixed,
  humanize,
  money,
  ratioPercent,
  signed,
  signedPercent,
  timestamp,
} from "../render/num.js";

/** One symbol's answer. `kind` says whether the stock or the ETF quote produced it. */
type Row = AnyQuote & {
  ticker: string;
  profile: StockProfile | null;
};

/** The valuation line: earnings-based for a stock, fund facts for an ETF. */
function valuation(row: Row): Block {
  if (row.kind === "etf") {
    const etf = row.quote;
    return {
      kind: "facts",
      items: fields(
        field("AUM", humanize(etf.aum)),
        // Both ratios, like `dividendYield` on the stock quote.
        field("Expense ratio", ratioPercent(etf.expenseRatio)),
        field("NAV", fixed(etf.nav)),
        field("Div yield", ratioPercent(etf.dividendYield)),
        field("52w", `${fixed(etf.week52Low)} to ${fixed(etf.week52High)}`),
      ),
    };
  }
  const quote = row.quote;
  return {
    kind: "facts",
    items: fields(
      field("Mkt cap", humanize(quote.marketCap)),
      field("P/E", fixed(quote.peRatio)),
      field("EPS TTM", fixed(quote.epsTTM)),
      // A ratio, unlike `changePercent` and the other percentages in the same payload.
      field("Div yield", ratioPercent(quote.dividendYield)),
      field(
        "52w",
        `${fixed(quote.week52Low)} to ${fixed(quote.week52High)}`,
      ),
    ),
  };
}

function single(row: Row, full: boolean): Block[] {
  const { quote, profile } = row;
  const tone = direction(quote.changePercent);
  const blocks: Block[] = [
    {
      kind: "head",
      title: field("ticker", row.ticker),
      subtitle: profile?.name ? field("name", profile.name) : undefined,
      right: fields(
        field("price", money(quote.currentPrice)),
        field(
          "change",
          `${signed(quote.change)} (${signedPercent(quote.changePercent)})`,
          tone,
        ),
      ),
    },
    {
      kind: "facts",
      items: fields(
        field("Open", fixed(quote.open)),
        field("High", fixed(quote.dayHigh)),
        field("Low", fixed(quote.dayLow)),
        field("Volume", humanize(quote.volume, 1)),
        field("Prev close", fixed(quote.previousClose)),
      ),
    },
    valuation(row),
  ];

  if (quote.extendedHours) {
    const ext = quote.extendedHours;
    blocks.push({
      kind: "facts",
      items: fields(
        field(
          ext.session === "pre" ? "Pre-market" : "After hours",
          money(ext.price),
        ),
        field(
          "Extended change",
          `${signed(ext.change)} (${signedPercent(ext.changePercent)})`,
          direction(ext.changePercent),
        ),
      ),
    });
  }

  if (full && row.kind === "etf") {
    blocks.push({
      kind: "kv",
      items: fields(
        row.quote.inceptionDate ? field("inception", row.quote.inceptionDate) : undefined,
      ),
    });
  } else if (full && row.kind === "stock") {
    blocks.push({
      kind: "kv",
      items: fields(
        field("200d average", fixed(row.quote.movingAverage200Day)),
        row.quote.reportedCurrency
          ? field("reported currency", row.quote.reportedCurrency)
          : undefined,
        profile?.sector ? field("sector", String(profile.sector)) : undefined,
        profile?.industry ? field("industry", String(profile.industry)) : undefined,
        profile?.ceo ? field("ceo", String(profile.ceo)) : undefined,
      ),
    });
  }

  const listingStatus = row.kind === "stock" ? row.quote.listingStatus : undefined;
  if (row.kind === "stock" && listingStatus === "DELISTED") {
    blocks.push({
      kind: "text",
      text: `Delisted on ${row.quote.delistedDate ?? "an unrecorded date"}. Every figure above is frozen at the last trade, not a live market move.`,
      tone: "down",
    });
  } else if (listingStatus === "PENDING_DELISTING") {
    blocks.push({
      kind: "text",
      text: "A merger or take-private is scheduled. The stock still trades, so these figures are current.",
      tone: "dim",
    });
  }

  // `priceAsOf` is the age of the data. `timestamp` is when the server answered, which says
  // nothing about how old the price is, so the two never get the same wording.
  blocks.push({
    kind: "text",
    text: quote.priceAsOf
      ? `price as of ${timestamp(quote.priceAsOf)}`
      : `served ${timestamp(quote.timestamp)}, price age not reported`,
    tone: "dim",
  });

  return blocks;
}

function table(rows: Row[], full: boolean): Block {
  const head = full
    ? ["TICKER", "NAME", "PRICE", "CHANGE", "CHANGE%", "VOLUME", "MKT CAP"]
    : ["TICKER", "PRICE", "CHANGE", "CHANGE%", "VOLUME", "MKT CAP"];
  return {
    kind: "table",
    head,
    align: full
      ? ["left", "left", "right", "right", "right", "right", "right"]
      : ["left", "right", "right", "right", "right", "right"],
    rows: rows.map((row) => {
      const tone = direction(row.quote.changePercent);
      const tail = [
        cell(fixed(row.quote.currentPrice), undefined),
        cell(signed(row.quote.change), tone),
        cell(signedPercent(row.quote.changePercent), tone),
        cell(humanize(row.quote.volume, 1)),
        // An ETF has no market cap; its AUM is a different number and stays out of this column.
        cell(humanize(row.kind === "stock" ? row.quote.marketCap : undefined)),
      ];
      return full
        ? [cell(row.ticker), cell(row.profile?.name ?? ""), ...tail]
        : [cell(row.ticker), ...tail];
    }),
  };
}

export const quoteCommand: CommandDef = {
  name: "quote",
  summary: "Price, day range, and valuation for one or more tickers",
  usage: "sentisense quote <ticker> [ticker...]",
  examples: [
    "sentisense quote NVDA",
    "sentisense quote NVDA AAPL MSFT",
    "sentisense quote NVDA --json",
    "sentisense quote NVDA --full",
  ],
  notes: [
    "Several tickers in one invocation is one process and one set of round trips, which is",
    "cheaper than calling the command once per symbol.",
    "Use canonical symbols, for example GOOGL rather than GOOG and BRK.B rather than BRK-B.",
    "One request per ticker. The company name costs a second request, so it is fetched only",
    "for the terminal layout: piped and --json output carry the quote alone.",
    "JSON is the exact quote response for one ticker, and an object keyed by ticker for more.",
    "An ETF symbol answers with the ETF quote: AUM, expense ratio and NAV in place of market",
    "cap, P/E and EPS. That costs one extra request per ETF symbol.",
    "With several tickers, one that fails does not lose the rest: the others print, each failed",
    "symbol is named on stderr, and the exit code is that failure's (4 for an unknown symbol).",
    "Under --json a failed symbol is left out of the object rather than given a null.",
  ],
  jsonShape: "Print the quote response as JSON; for several tickers, an object keyed by ticker",
  flags: {},
  async run({ args, client, full, mode }) {
    const tickers = args.positionals.map((t) => t.toUpperCase());
    if (tickers.length === 0) {
      throw new CliUsageError("quote needs at least one ticker.", "for example: sentisense quote NVDA");
    }

    const api = client();
    // The display name is worth a request when a person is reading the output, and is dead
    // weight for a pipe or a parser. A free key gets 30 requests a minute, so halving the
    // per-ticker cost is the difference between 15 symbols and 30.
    const wantName = mode === "pretty";

    // Settled one by one, so a single bad symbol cannot throw away quotes already paid for.
    const settled = await Promise.allSettled(
      tickers.map(async (ticker): Promise<Row> => {
        const [answer, profile] = await Promise.all([
          quoteAnyTicker(api, ticker),
          // A name is a nicety, not the answer. A ticker with no profile still gets a quote.
          wantName ? api.stocks.getProfile(ticker).catch(() => null) : Promise.resolve(null),
        ]);
        return { ...answer, ticker, profile };
      }),
    );

    const rows: Row[] = [];
    const failed: Array<{ ticker: string; error: unknown }> = [];
    settled.forEach((outcome, index) => {
      if (outcome.status === "fulfilled") rows.push(outcome.value);
      else failed.push({ ticker: tickers[index], error: outcome.reason });
    });

    // Nothing came back: the first symbol's error is the command's error, as it always was.
    if (rows.length === 0) throw failed[0].error;

    const notes = rows.flatMap((row) => (row.note ? [row.note] : []));

    // The shape follows how many tickers were asked for, not how many answered, so a parser
    // never sees a keyed object turn into a bare quote because one symbol failed.
    if (tickers.length === 1) {
      return { json: rows[0].quote, doc: doc(...single(rows[0], full)), notes };
    }

    const json: Record<string, AnyQuote["quote"]> = {};
    for (const row of rows) json[row.ticker] = row.quote;
    const result: CommandResult = { json, doc: doc(table(rows, full)), notes };
    if (failed.length > 0) Object.assign(result, partialFailure(failed, args.flags.debug === true));
    return result;
  },
};

/**
 * Stderr lines and the exit code for the symbols that failed in a batch: one `error:` line per
 * symbol, naming it, then each distinct `next:` line once. The exit code is the first failed
 * symbol's, so one unknown symbol exits 4 exactly as it did when it sank the whole batch.
 */
function partialFailure(
  failed: Array<{ ticker: string; error: unknown }>,
  debug: boolean,
): Pick<CommandResult, "errors" | "exitCode"> {
  const errors: string[] = [];
  const advice = new Set<string>();
  let exitCode: number | undefined;
  for (const { ticker, error } of failed) {
    const report = describeError(error, debug, "quote");
    if (exitCode === undefined) exitCode = report.exitCode;
    const [first, ...rest] = report.lines;
    errors.push(first.replace(/^error: /, `error: ${ticker}: `));
    for (const line of rest) advice.add(line);
  }
  return { errors: [...errors, ...advice], exitCode };
}
