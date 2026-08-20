import type { GetInsightsOptions } from "../../types.js";
import type { CommandDef } from "../command.js";
import { CliUsageError } from "../errors.js";
import { cell, doc, field, fields, type Block, type Tone } from "../render/doc.js";
import { dateFromSeconds, percent, truncate } from "../render/num.js";

function urgencyTone(urgency: string): Tone | undefined {
  if (urgency === "high") return "accent";
  if (urgency === "low") return "dim";
  return undefined;
}

export const insightsCommand: CommandDef = {
  name: "insights",
  summary: "Generated signals for one ticker, most urgent first",
  usage: "sentisense insights <ticker> [--urgency low|medium|high] [--type <name>]",
  examples: [
    "sentisense insights NVDA",
    "sentisense insights NVDA --urgency high",
    "sentisense insights NVDA --type insider_buy_signal --full",
  ],
  notes: [
    "Signals are generated observations about filings, flows, and attention, ordered by",
    "urgency then confidence. They describe what the data shows, not what to do about it.",
    "A free key sees the top three; a PRO key sees the whole list.",
  ],
  flags: {
    urgency: { type: "string", placeholder: "level", describe: "Filter to low, medium, or high" },
    type: { type: "string", placeholder: "name", describe: "Filter to one signal type" },
  },
  async run({ args, client, full }) {
    const ticker = args.positionals[0]?.toUpperCase();
    if (!ticker) {
      throw new CliUsageError(
        "insights needs a ticker.",
        "for example: sentisense insights NVDA",
      );
    }
    const urgency = typeof args.flags.urgency === "string" ? args.flags.urgency : undefined;
    if (urgency && !["low", "medium", "high"].includes(urgency)) {
      throw new CliUsageError(
        `--urgency takes low, medium, or high, got "${urgency}".`,
        "for example: --urgency high",
      );
    }
    const options: GetInsightsOptions = {
      ...(urgency ? { urgency } : {}),
      ...(typeof args.flags.type === "string" ? { insightType: args.flags.type } : {}),
    };

    const envelope = await client().insights.stock(
      ticker,
      Object.keys(options).length > 0 ? options : undefined,
    );
    const insights = envelope.data ?? [];
    const shown = full ? insights : insights.slice(0, 8);

    const blocks: Block[] = [
      {
        kind: "head",
        title: field("ticker", ticker),
        right: fields(
          field("signals", String(insights.length)),
          envelope.totalCount === undefined
            ? undefined
            : field("available", String(envelope.totalCount)),
        ),
      },
    ];

    if (shown.length === 0) {
      blocks.push({ kind: "text", text: "No signals match that filter right now." });
    } else if (full) {
      for (const insight of shown) {
        blocks.push({ kind: "blank" });
        blocks.push({
          kind: "head",
          title: field("type", insight.insightType),
          right: fields(
            field("urgency", insight.urgency, urgencyTone(insight.urgency)),
            field("confidence", percent(insight.confidence * 100, 0)),
            field("generated", dateFromSeconds(insight.generatedAt)),
          ),
        });
        blocks.push({ kind: "text", text: insight.insightText });
      }
    } else {
      blocks.push({
        kind: "table",
        head: ["URGENCY", "CONF", "TYPE", "SIGNAL"],
        align: ["left", "right", "left", "left"],
        rows: shown.map((insight) => [
          cell(insight.urgency, urgencyTone(insight.urgency)),
          cell(percent(insight.confidence * 100, 0)),
          cell(insight.insightType),
          cell(truncate(insight.insightText, 60)),
        ]),
      });
      blocks.push({
        kind: "text",
        text: "Add --full for the complete text of each signal.",
        tone: "dim",
      });
    }

    if (envelope.isPreview) {
      blocks.push({
        kind: "text",
        text: "Preview response: a PRO key returns every signal.",
        tone: "dim",
      });
    }

    return { json: envelope, doc: doc(...blocks) };
  },
};
