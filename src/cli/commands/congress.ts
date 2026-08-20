import type { CongressTrade, PreviewResponse } from "../../types.js";
import type { CommandDef } from "../command.js";
import { cell, doc, field, fields, type Block } from "../render/doc.js";
import {
  EMPTY_VERIFY_NOTE,
  EMPTY_VERIFY_NOTE_2,
  optionalTicker,
  verifyTickerOnEmpty,
} from "../ticker.js";
import { truncate } from "../render/num.js";

export const congressCommand: CommandDef = {
  name: "congress",
  summary: "Congressional stock disclosures, market-wide or for one ticker",
  usage: "sentisense congress [ticker] [--days N] [--limit N]",
  examples: [
    "sentisense congress",
    "sentisense congress NVDA",
    "sentisense congress --days 30 --limit 50 --full",
    "sentisense congress NVDA --json",
  ],
  notes: [
    "Disclosures are filed after the fact, so the gap between the trade date and the",
    "disclosure date is part of the picture. The delay column carries it in days.",
    "Amounts are the filed ranges, never exact figures: that is how the filings work.",
    "A free key sees a short preview of either feed.",
    EMPTY_VERIFY_NOTE,
    EMPTY_VERIFY_NOTE_2,
  ],
  flags: {
    days: { type: "number", placeholder: "N", describe: "Look-back window, 1 to 365 (default 90)" },
    limit: { type: "number", placeholder: "N", describe: "Rows to request, market-wide feed only" },
  },
  async run({ args, client, full }) {
    const api = client();
    const ticker = optionalTicker(args, "congress");
    const notes: string[] = [];
    const lookbackDays = typeof args.flags.days === "number" ? args.flags.days : undefined;
    const limit = typeof args.flags.limit === "number" ? args.flags.limit : undefined;

    let envelope: PreviewResponse<CongressTrade[]>;
    if (ticker) {
      envelope = await api.politicians.getFilings(
        ticker,
        lookbackDays === undefined ? undefined : { lookbackDays },
      );
    } else {
      const options = {
        ...(lookbackDays === undefined ? {} : { lookbackDays }),
        ...(limit === undefined ? {} : { limit }),
      };
      envelope = await api.politicians.getActivity(
        Object.keys(options).length > 0 ? options : undefined,
      );
    }

    const trades = envelope.data ?? [];
    if (ticker && trades.length === 0) {
      const note = await verifyTickerOnEmpty(api, ticker);
      if (note) notes.push(note);
    }
    const shown = full ? trades : trades.slice(0, 20);

    const blocks: Block[] = [
      {
        kind: "head",
        title: field("scope", ticker ?? "All disclosures"),
        right: fields(
          field("rows", String(trades.length)),
          envelope.totalCount === undefined
            ? undefined
            : field("matching", String(envelope.totalCount)),
        ),
      },
    ];

    if (shown.length === 0) {
      blocks.push({ kind: "text", text: "No disclosures in this window." });
    } else {
      const head = ticker
        ? ["TRADED", "MEMBER", "PARTY", "TYPE", "AMOUNT", "DELAY"]
        : ["TRADED", "MEMBER", "TICKER", "TYPE", "AMOUNT", "DELAY"];
      blocks.push({
        kind: "table",
        head,
        align: ["left", "left", "left", "left", "left", "right"],
        rows: shown.map((trade) => [
          cell(trade.transactionDate),
          cell(truncate(trade.politicianName, full ? 40 : 22)),
          // Party and state are absent on some disclosures, so build the label from what is
          // actually there rather than printing a placeholder.
          cell(ticker ? [trade.party, trade.state].filter(Boolean).join(" ") : trade.ticker),
          cell(
            trade.transactionType,
            trade.transactionType === "PURCHASE"
              ? "up"
              : trade.transactionType === "SALE"
                ? "down"
                : undefined,
          ),
          cell(trade.amountRange),
          cell(`${trade.disclosureDelayDays}d`),
        ]),
      });
      if (!full && trades.length > shown.length) {
        blocks.push({
          kind: "text",
          text: `Showing ${shown.length} of ${trades.length}. Add --full for the rest.`,
          tone: "dim",
        });
      }
    }

    if (envelope.isPreview) {
      blocks.push({
        kind: "text",
        text: "Preview response: a PRO key returns the full feed.",
        tone: "dim",
      });
    }

    return { json: envelope, doc: doc(...blocks), notes };
  },
};
