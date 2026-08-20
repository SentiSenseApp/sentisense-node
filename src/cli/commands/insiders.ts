import type { CommandDef } from "../command.js";
import { EMPTY_VERIFY_NOTE, EMPTY_VERIFY_NOTE_2, oneTicker, verifyTickerOnEmpty } from "../ticker.js";
import { cell, doc, field, fields, type Block } from "../render/doc.js";
import { humanize, truncate } from "../render/num.js";

export const insidersCommand: CommandDef = {
  name: "insiders",
  summary: "Form 4 insider transactions for one ticker",
  usage: "sentisense insiders <ticker> [--days N]",
  examples: [
    "sentisense insiders NVDA",
    "sentisense insiders NVDA --days 180 --full",
    "sentisense insiders NVDA --json",
  ],
  notes: [
    "Rows are individual filed transactions, newest first, not a net total.",
    "The bought/sold figures count open-market rows only. Form 4 code F rows (shares withheld",
    "to cover taxes on vesting) arrive typed SELL but are mechanical withholding, not a decision",
    "to sell, so they are excluded from sold and shown separately as withheld.",
    "The plan column says whether the trade was under a confirmed pre-arranged 10b5-1 plan,",
    "which is the difference between a scheduled sale and a discretionary one.",
    "A free key sees the top few transactions; a PRO key sees the window you asked for.",
    EMPTY_VERIFY_NOTE,
    EMPTY_VERIFY_NOTE_2,
  ],
  flags: {
    days: { type: "number", placeholder: "N", describe: "Look-back window, 1 to 365 (default 90)" },
  },
  async run({ args, client, full }) {
    const ticker = oneTicker(args, "insiders");
    const lookbackDays = typeof args.flags.days === "number" ? args.flags.days : undefined;

    const api = client();
    const notes: string[] = [];
    const envelope = await api.insider.getTrades(
      ticker,
      lookbackDays === undefined ? undefined : { lookbackDays },
    );
    const trades = envelope.data ?? [];
    if (trades.length === 0) {
      const note = await verifyTickerOnEmpty(api, ticker);
      if (note) notes.push(note);
    }
    const shown = full ? trades : trades.slice(0, 15);

    const isWithholding = (row: (typeof trades)[number]) => row.transactionCode === "F";
    const buys = trades.filter((trade) => trade.transactionType === "BUY");
    const sells = trades.filter((trade) => trade.transactionType === "SELL" && !isWithholding(trade));
    const withheld = trades.filter(isWithholding);
    const sum = (rows: typeof trades) => rows.reduce((total, row) => total + (row.totalValue || 0), 0);

    const headline = [
      field("trades", String(trades.length)),
      field("bought", humanize(sum(buys)), buys.length > 0 ? "up" : undefined),
      field("sold", humanize(sum(sells)), sells.length > 0 ? "down" : undefined),
    ];
    if (withheld.length > 0) headline.push(field("withheld", humanize(sum(withheld))));

    const blocks: Block[] = [
      {
        kind: "head",
        title: field("ticker", ticker),
        right: fields(...headline),
      },
    ];

    if (shown.length === 0) {
      blocks.push({ kind: "text", text: "No filed insider transactions in this window." });
    } else {
      blocks.push({
        kind: "table",
        head: ["DATE", "INSIDER", "ROLE", "TYPE", "SHARES", "VALUE", "PLAN"],
        align: ["left", "left", "left", "left", "right", "right", "left"],
        rows: shown.map((trade) => [
          cell(trade.transactionDate),
          cell(truncate(trade.insiderName, full ? 40 : 22)),
          cell(truncate(trade.insiderTitle ?? "", full ? 40 : 18)),
          cell(
            isWithholding(trade) ? "TAX-W" : trade.transactionType,
            !isWithholding(trade) && trade.transactionType === "BUY"
              ? "up"
              : !isWithholding(trade) && trade.transactionType === "SELL"
                ? "down"
                : undefined,
          ),
          cell(humanize(trade.sharesTransacted, 1)),
          cell(humanize(trade.totalValue)),
          cell(trade.rule10b51 ? "10b5-1" : ""),
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
        text: `Preview response: ${envelope.totalCount ?? "more"} transactions exist, a PRO key returns them all.`,
        tone: "dim",
      });
    }

    return { json: envelope, doc: doc(...blocks), notes };
  },
};
