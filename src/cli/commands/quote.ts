import type { StockProfile, StockQuote } from "../../types.js";
import type { CommandDef } from "../command.js";
import { CliUsageError } from "../errors.js";
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

interface Row {
  ticker: string;
  quote: StockQuote;
  profile: StockProfile | null;
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
    {
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
    },
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

  if (full) {
    blocks.push({
      kind: "kv",
      items: fields(
        field("200d average", fixed(quote.movingAverage200Day)),
        quote.reportedCurrency ? field("reported currency", quote.reportedCurrency) : undefined,
        profile?.sector ? field("sector", String(profile.sector)) : undefined,
        profile?.industry ? field("industry", String(profile.industry)) : undefined,
        profile?.ceo ? field("ceo", String(profile.ceo)) : undefined,
      ),
    });
  }

  if (quote.listingStatus === "DELISTED") {
    blocks.push({
      kind: "text",
      text: `Delisted on ${quote.delistedDate ?? "an unrecorded date"}. Every figure above is frozen at the last trade, not a live market move.`,
      tone: "down",
    });
  } else if (quote.listingStatus === "PENDING_DELISTING") {
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
        cell(humanize(row.quote.marketCap)),
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
  ],
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

    const rows: Row[] = await Promise.all(
      tickers.map(async (ticker) => {
        const [quote, profile] = await Promise.all([
          api.stocks.getQuote(ticker),
          // A name is a nicety, not the answer. A ticker with no profile still gets a quote.
          wantName ? api.stocks.getProfile(ticker).catch(() => null) : Promise.resolve(null),
        ]);
        return { ticker, quote, profile };
      }),
    );

    if (rows.length === 1) {
      return { json: rows[0].quote, doc: doc(...single(rows[0], full)) };
    }

    const json: Record<string, StockQuote> = {};
    for (const row of rows) json[row.ticker] = row.quote;
    return { json, doc: doc(table(rows, full)) };
  },
};
