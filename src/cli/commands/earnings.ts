import type { GetEarningsCalendarOptions } from "../../types.js";
import type { CommandDef } from "../command.js";
import { CliUsageError } from "../errors.js";
import {
  EMPTY_VERIFY_NOTE,
  EMPTY_VERIFY_NOTE_2,
  optionalTicker,
  verifyTickerOnEmpty,
} from "../ticker.js";
import { cell, doc, field, fields, type Block } from "../render/doc.js";
import { dateFromSeconds, fixed, truncate } from "../render/num.js";

const TIME_LABEL: Record<string, string> = {
  before_open: "pre-open",
  after_close: "post-close",
  during_market: "intraday",
  unknown: "unknown",
};

export const earningsCommand: CommandDef = {
  name: "earnings",
  summary: "Upcoming report dates, or the quarter-by-quarter analysis for one ticker",
  usage: "sentisense earnings [ticker] [--week this|next] [--limit N]",
  examples: [
    "sentisense earnings",
    "sentisense earnings --week next",
    "sentisense earnings AAPL",
    "sentisense earnings AAPL --limit 4 --full",
  ],
  notes: [
    "With no ticker this is the forward calendar: who reports, when, and the consensus EPS.",
    "With a ticker it is the backward-looking analysis: one entry per reported quarter with",
    "the editorial headline, and on a PRO key the written summary and guidance language.",
    "A free key sees the current week of the calendar and the latest quarter of the analysis.",
    "Coverage of the per-ticker analysis is not the whole market, so a tracked company can",
    "have no stored quarter yet.",
    EMPTY_VERIFY_NOTE,
    EMPTY_VERIFY_NOTE_2,
  ],
  flags: {
    week: { type: "string", placeholder: "this|next", describe: "Calendar window shorthand" },
    from: { type: "string", placeholder: "YYYY-MM-DD", describe: "Calendar lower bound" },
    to: { type: "string", placeholder: "YYYY-MM-DD", describe: "Calendar upper bound" },
    confirmed: { type: "boolean", describe: "Calendar: only company-confirmed dates" },
    limit: { type: "number", placeholder: "N", describe: "Quarters to return for a ticker" },
  },
  async run({ args, client, full }) {
    const api = client();
    const ticker = optionalTicker(args, "earnings");
    const notes: string[] = [];

    if (ticker) {
      const limit = typeof args.flags.limit === "number" ? args.flags.limit : undefined;
      const envelope = await api.earnings.getSummaries(
        ticker,
        limit === undefined ? undefined : { limit },
      );
      const quarters = envelope.data ?? [];
      if (quarters.length === 0) {
        const note = await verifyTickerOnEmpty(api, ticker);
        if (note) notes.push(note);
      }
      const blocks: Block[] = [
        {
          kind: "head",
          title: field("ticker", ticker),
          right: fields(
            field("quarters", String(quarters.length)),
            envelope.totalCount === undefined
              ? undefined
              : field("available", String(envelope.totalCount)),
          ),
        },
      ];

      if (quarters.length === 0) {
        blocks.push({ kind: "text", text: "No stored quarters for this ticker yet." });
      } else {
        blocks.push({
          kind: "table",
          head: ["PERIOD", "REPORTED", "CALL", "HEADLINE"],
          rows: quarters.map((quarter) => [
            cell(quarter.fiscalPeriod),
            cell(quarter.reportDate),
            cell(quarter.hasTranscript ? "yes" : "no", quarter.hasTranscript ? "up" : "dim"),
            cell(truncate(quarter.headline ?? "", full ? 200 : 60)),
          ]),
        });

        if (full) {
          for (const quarter of quarters) {
            blocks.push({ kind: "blank" });
            blocks.push({
              kind: "head",
              title: field("period", quarter.fiscalPeriod),
              subtitle: field("reported", quarter.reportDate),
            });
            const highlights = quarter.kpiHighlights ?? [];
            if (highlights.length > 0) {
              blocks.push({
                kind: "kv",
                items: highlights.map((kpi) =>
                  field(kpi.label, kpi.yoy ? `${kpi.value}  ${kpi.yoy}` : kpi.value),
                ),
              });
            }
            if (quarter.guidance) {
              blocks.push({ kind: "text", text: `Guidance: ${quarter.guidance}` });
            } else if (quarter.guidanceDirection) {
              blocks.push({ kind: "text", text: `Guidance direction: ${quarter.guidanceDirection}` });
            }
            if (quarter.summaryMd) blocks.push({ kind: "text", text: quarter.summaryMd });
            blocks.push({
              kind: "text",
              text: `written ${dateFromSeconds(quarter.generatedAt)} from the ${quarter.source === "transcript" ? "earnings call" : "press release"}`,
              tone: "dim",
            });
          }
        }
      }

      if (envelope.isPreview) {
        blocks.push({
          kind: "text",
          text: "Preview response: a PRO key returns every quarter with the written body and guidance.",
          tone: "dim",
        });
      }

      return { json: envelope, doc: doc(...blocks), notes };
    }

    const week = typeof args.flags.week === "string" ? args.flags.week : undefined;
    if (week && week !== "this" && week !== "next") {
      throw new CliUsageError(
        `--week takes "this" or "next", got "${week}".`,
        "for example: --week next",
      );
    }
    const options: GetEarningsCalendarOptions = {
      ...(week ? { week: week as "this" | "next" } : {}),
      ...(typeof args.flags.from === "string" ? { from: args.flags.from } : {}),
      ...(typeof args.flags.to === "string" ? { to: args.flags.to } : {}),
      ...(args.flags.confirmed === true ? { confirmed: true } : {}),
    };

    const envelope = await api.calendar.getEarnings(
      Object.keys(options).length > 0 ? options : undefined,
    );
    const events = envelope.data?.earnings ?? [];
    const meta = envelope.data?.metadata;
    const shown = full ? events : events.slice(0, 25);

    const blocks: Block[] = [
      {
        kind: "head",
        title: field("window", "Earnings calendar"),
        right: fields(
          field("from", meta?.windowStart ?? "n/a"),
          field("to", meta?.windowEnd ?? "n/a"),
          field("events", String(events.length)),
        ),
      },
    ];

    if (shown.length === 0) {
      blocks.push({ kind: "text", text: "No scheduled reports in this window." });
    } else {
      blocks.push({
        kind: "table",
        head: ["DATE", "TICKER", "WHEN", "PERIOD", "EPS EST", "CONFIRMED"],
        align: ["left", "left", "left", "left", "right", "left"],
        rows: shown.map((event) => [
          cell(event.earningsDate),
          cell(event.ticker),
          cell(TIME_LABEL[event.earningsTime] ?? event.earningsTime),
          cell(event.fiscalQuarter ?? ""),
          cell(fixed(event.estimatedEps)),
          cell(event.confirmed ? "yes" : "no", event.confirmed ? "up" : "dim"),
        ]),
      });
      if (!full && events.length > shown.length) {
        blocks.push({
          kind: "text",
          text: `Showing ${shown.length} of ${events.length}. Add --full for the rest.`,
          tone: "dim",
        });
      }
    }

    if (envelope.isPreview) {
      blocks.push({
        kind: "text",
        text: "Preview response: a free key sees the current week, a PRO key sees about 30 days ahead.",
        tone: "dim",
      });
    }

    return { json: envelope, doc: doc(...blocks) };
  },
};
