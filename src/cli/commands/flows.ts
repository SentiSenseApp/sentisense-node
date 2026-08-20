import type { Quarter } from "../../types.js";
import type { CommandDef } from "../command.js";
import { cell, doc, field, fields, type Block } from "../render/doc.js";
import { humanize, percent, truncate } from "../render/num.js";
import {
  EMPTY_VERIFY_NOTE,
  EMPTY_VERIFY_NOTE_2,
  optionalTicker,
  verifyTickerOnEmpty,
} from "../ticker.js";

const DEFAULT_ROWS = 10;

/**
 * The newest quarter whose filing window has closed.
 *
 * Taking the newest quarter outright is a trap: the list leads with the current one, and for
 * the 45 days after quarter end it is still open, so a holders request against it answers 200
 * with few rows or none. That is correct server behaviour and reads exactly like a stock with
 * no institutional owners. Falls back to the newest quarter of any state, so a caller still
 * gets an answer if every row happens to be pending.
 */
export function latestSettledQuarter(quarters: Quarter[]): string | undefined {
  const dated = quarters.filter((q): q is Quarter & { reportDate: string } =>
    typeof q.reportDate === "string",
  );
  const newestFirst = [...dated].sort((a, b) => b.reportDate.localeCompare(a.reportDate));
  const settled = newestFirst.find((q) => q.pending !== true);
  return (settled ?? newestFirst[0])?.reportDate;
}

export const flowsCommand: CommandDef = {
  name: "flows",
  summary: "Institutional 13F activity: market-wide flows, or one ticker's holders",
  usage: "sentisense flows [ticker] [--limit N] [--quarter YYYY-MM-DD]",
  examples: [
    "sentisense flows",
    "sentisense flows NVDA",
    "sentisense flows NVDA --limit 25 --full",
    "sentisense flows --json",
  ],
  notes: [
    "With no ticker this is the quarter's biggest net share inflows and outflows across the",
    "market. With a ticker it is that stock's institutional ownership and the quarter's",
    "notable position changes, since flows are only published market-wide.",
    "13F filings land up to 45 days after quarter end, so a still-open quarter shows only",
    "early filers and says so, and a ticker reads the newest quarter that has closed.",
    EMPTY_VERIFY_NOTE,
    EMPTY_VERIFY_NOTE_2,
  ],
  flags: {
    limit: { type: "number", placeholder: "N", describe: `Rows per side (default ${DEFAULT_ROWS})` },
    quarter: { type: "string", placeholder: "YYYY-MM-DD", describe: "Report date to read" },
  },
  async run({ args, client, full }) {
    const api = client();
    const ticker = optionalTicker(args, "flows");
    const notes: string[] = [];
    const limit = typeof args.flags.limit === "number" ? args.flags.limit : DEFAULT_ROWS;
    const quarter = typeof args.flags.quarter === "string" ? args.flags.quarter : undefined;

    if (ticker) {
      // Holders are addressed by report date, so resolve the quarter before asking for them.
      let reportDate = quarter;
      if (!reportDate) {
        reportDate = latestSettledQuarter(await api.institutional.getQuarters());
      }
      if (!reportDate) {
        return {
          json: { quarters: [] },
          doc: doc({ kind: "text", text: "No reporting quarters are available yet." }),
        };
      }

      const envelope = await api.institutional.getHolders(ticker, reportDate, {
        limit: full ? Math.max(limit, 50) : limit,
        sortBy: "valueUsd",
        sortDir: "desc",
      });
      const data = envelope.data;
      const holders = data?.holders ?? [];
      if (holders.length === 0) {
        const note = await verifyTickerOnEmpty(api, ticker);
        if (note) notes.push(note);
      }

      const blocks: Block[] = [
        {
          kind: "head",
          title: field("ticker", ticker),
          subtitle: data?.companyName ? field("name", data.companyName) : undefined,
          right: fields(
            field("quarter", data?.reportDate ?? reportDate),
            field("holders", String(data?.holderCount ?? holders.length)),
            field("value", humanize(data?.totalInstitutionalValue)),
          ),
        },
      ];

      if (holders.length === 0) {
        blocks.push({ kind: "text", text: "No institutional holders on file for this quarter." });
      } else {
        blocks.push({
          kind: "table",
          head: ["FILER", "CATEGORY", "SHARES", "VALUE", "CHANGE", "CHANGE%"],
          align: ["left", "left", "right", "right", "left", "right"],
          rows: holders.map((holder) => [
            cell(truncate(holder.filerName, full ? 44 : 28)),
            cell(holder.filerCategory ?? ""),
            cell(humanize(holder.shares, 1)),
            cell(humanize(holder.valueUsd)),
            cell(
              holder.changeType,
              holder.changeType === "NEW" || holder.changeType === "INCREASED"
                ? "up"
                : holder.changeType === "SOLD_OUT" || holder.changeType === "DECREASED"
                  ? "down"
                  : undefined,
            ),
            cell(percent(holder.sharesChangePct, 1)),
          ]),
        });
      }

      const notable = data?.notableChanges;
      if (full && notable && notable.top.length > 0) {
        blocks.push({ kind: "blank" });
        blocks.push({
          kind: "text",
          text: `${notable.count} holders changed position materially this quarter. Top movers:`,
        });
        blocks.push({
          kind: "table",
          head: ["FILER", "CHANGE", "SHARES", "CHANGE%"],
          align: ["left", "left", "right", "right"],
          rows: notable.top.map((holder) => [
            cell(truncate(holder.filerName, 44)),
            cell(holder.changeType),
            cell(humanize(holder.sharesChange, 1)),
            cell(percent(holder.sharesChangePct, 1)),
          ]),
        });
      }

      if (envelope.isPreview) {
        blocks.push({
          kind: "text",
          text: "Preview response: a PRO key returns the whole holder list.",
          tone: "dim",
        });
      }

      return { json: envelope, doc: doc(...blocks), notes };
    }

    const envelope = await api.institutional.getFlows(quarter, { limit });
    const data = envelope.data;
    const blocks: Block[] = [
      {
        kind: "head",
        title: field("scope", "Institutional flows"),
        right: fields(
          field("quarter", data?.reportDate ?? quarter ?? "latest"),
          data?.isPending
            ? field("filers", `${data.filerCount ?? "?"} of ${data.baselineFilerCount ?? "?"}`)
            : undefined,
        ),
      },
    ];

    if (data?.isPending) {
      blocks.push({
        kind: "text",
        text: "This quarter is still open, so only early filers are represented and the totals are partial.",
        tone: "dim",
      });
    }

    const side = (title: string, rows: NonNullable<typeof data>["inflows"], tone: "up" | "down") => {
      blocks.push({ kind: "blank" });
      blocks.push({ kind: "text", text: title });
      blocks.push({
        kind: "table",
        head: ["TICKER", "COMPANY", "NET SHARES", "DOLLAR FLOW", "NEW", "SOLD OUT"],
        align: ["left", "left", "right", "right", "right", "right"],
        rows: rows.map((flow) => [
          cell(flow.ticker),
          cell(truncate(flow.companyName ?? "", full ? 40 : 26)),
          cell(humanize(flow.netSharesChange, 1), tone),
          cell(humanize(flow.dollarFlowUsd), tone),
          cell(String(flow.newPositions)),
          cell(String(flow.soldOutPositions)),
        ]),
      });
    };

    if (data?.inflows?.length) side("Largest net buying", data.inflows, "up");
    if (data?.outflows?.length) side("Largest net selling", data.outflows, "down");
    if (!data?.inflows?.length && !data?.outflows?.length) {
      blocks.push({ kind: "text", text: "No flows recorded for this quarter." });
    }

    if (envelope.isPreview) {
      blocks.push({
        kind: "text",
        text: "Preview response: a PRO key returns the full flow tables.",
        tone: "dim",
      });
    }

    return { json: envelope, doc: doc(...blocks) };
  },
};
