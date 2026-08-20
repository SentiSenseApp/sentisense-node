import type { CommandDef } from "../command.js";
import { CliUsageError } from "../errors.js";
import { cell, doc, field, fields, type Block, type Tone } from "../render/doc.js";
import { direction, fixed, money, signedPercent } from "../render/num.js";

const DEFAULT_ACTIONS = 5;

function actionTone(actionType: string | undefined): Tone | undefined {
  if (actionType === "UPGRADE") return "up";
  if (actionType === "DOWNGRADE") return "down";
  return undefined;
}

export const analystsCommand: CommandDef = {
  name: "analysts",
  summary: "Wall Street consensus, price target band, and recent rating changes",
  usage: "sentisense analysts <ticker> [--days N]",
  examples: [
    "sentisense analysts NVDA",
    "sentisense analysts NVDA --days 180 --full",
    "sentisense analysts NVDA --json",
  ],
  notes: [
    "The price target band and analyst count come back in full on every key.",
    "The buy / hold / sell distribution and the longer action history are PRO.",
    "A ticker with no analyst coverage exits 4 rather than returning an empty band.",
  ],
  flags: {
    days: { type: "number", placeholder: "N", describe: "Days of rating history (default 90)" },
  },
  async run({ args, client, full }) {
    const ticker = args.positionals[0]?.toUpperCase();
    if (!ticker) {
      throw new CliUsageError(
        "analysts needs a ticker.",
        "for example: sentisense analysts NVDA",
      );
    }
    const lookbackDays = typeof args.flags.days === "number" ? args.flags.days : undefined;

    const api = client();
    const notes: string[] = [];
    const [consensus, actions] = await Promise.all([
      api.analyst.consensus(ticker),
      // Supplementary: the consensus is the answer, so a failure here trims the output
      // rather than failing the command, and says so on stderr instead of vanishing.
      api.analyst
        .actions(ticker, lookbackDays === undefined ? undefined : { lookbackDays })
        .catch(() => {
          notes.push("rating history unavailable, showing the consensus without it");
          return null;
        }),
    ]);

    const data = consensus.data;
    const blocks: Block[] = [
      {
        kind: "head",
        title: field("ticker", ticker),
        right: fields(
          field("target mean", money(data?.targetMean)),
          field(
            "upside",
            signedPercent(data?.upsidePercent),
            direction(data?.upsidePercent),
          ),
        ),
      },
      {
        kind: "facts",
        items: fields(
          field("Analysts", data?.numberOfAnalysts === undefined ? "n/a" : String(data.numberOfAnalysts)),
          field("Consensus", data?.consensusLabel ?? "n/a"),
          field("Low", fixed(data?.targetLow)),
          field("Median", fixed(data?.targetMedian)),
          field("High", fixed(data?.targetHigh)),
        ),
      },
      {
        kind: "facts",
        items: fields(
          field("Strong buy", String(data?.strongBuy ?? 0)),
          field("Buy", String(data?.buy ?? 0)),
          field("Hold", String(data?.hold ?? 0)),
          field("Sell", String(data?.sell ?? 0)),
          field("Strong sell", String(data?.strongSell ?? 0)),
        ),
      },
    ];

    const rows = actions?.data ?? [];
    if (rows.length > 0) {
      const shown = full ? rows : rows.slice(0, DEFAULT_ACTIONS);
      blocks.push({ kind: "blank" });
      blocks.push({
        kind: "table",
        head: ["DATE", "FIRM", "ACTION", "FROM", "TO"],
        rows: shown.map((action) => [
          cell(action.actionDate),
          cell(action.firm),
          cell(action.actionType, actionTone(action.actionType)),
          cell(action.fromGrade ?? ""),
          cell(action.toGrade ?? ""),
        ]),
      });
      if (!full && rows.length > shown.length) {
        blocks.push({
          kind: "text",
          text: `Showing ${shown.length} of ${rows.length} rating changes. Add --full for the rest.`,
          tone: "dim",
        });
      }
    }

    if (consensus.isPreview) {
      blocks.push({
        kind: "text",
        text: "Preview response: the rating distribution reads zero and the history is trimmed on a free key.",
        tone: "dim",
      });
    }

    return { json: { consensus, actions }, doc: doc(...blocks), notes };
  },
};
