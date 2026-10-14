import type { SentiSense } from "../../client.js";
import type { OptionsWall } from "../../types.js";
import type { CommandDef, CommandResult } from "../command.js";
import { CliUsageError } from "../errors.js";
import { EMPTY_VERIFY_NOTE, EMPTY_VERIFY_NOTE_2, oneTicker, verifyTickerOnEmpty } from "../ticker.js";
import { cell, doc, field, fields, type Block } from "../render/doc.js";
import { direction, fixed, humanize, signed } from "../render/num.js";

const SESSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Contract side arrives lower case on the wire, so compare without assuming a case. */
function contractTone(type: string | undefined): "up" | "down" | undefined {
  const side = type?.toUpperCase();
  if (side === "CALL") return "up";
  if (side === "PUT") return "down";
  return undefined;
}

function walls(rows: OptionsWall[] | undefined): string {
  if (!rows || rows.length === 0) return "n/a";
  return rows.map((wall) => `${fixed(wall.strike, 0)} (${humanize(wall.oi, 1)})`).join("  ");
}

/**
 * One session's intraday series, every 15-minute cycle the ticker was on the board.
 *
 * PRO only: a free key gets a preview with no payload, which is an answer rather than a
 * failure, so it exits 0 and says why the table is missing.
 */
async function intraday(api: SentiSense, ticker: string, session: string | undefined): Promise<CommandResult> {
  const envelope = await api.stocks.getOptionsIntradayHistory(ticker, { session });
  const data = envelope.data;

  if (envelope.isPreview && !data) {
    const lines: Block[] = [
      { kind: "text", text: `Intraday options history for ${ticker} needs a PRO key.` },
    ];
    if (envelope.upgrade?.url) {
      lines.push({ kind: "text", text: envelope.upgrade.url, tone: "dim" });
    }
    return { json: envelope, doc: doc(...lines) };
  }

  const series = data?.series ?? [];
  const served = data?.session ?? session ?? "the latest session";
  if (series.length === 0) {
    const note = await verifyTickerOnEmpty(api, ticker);
    return {
      json: envelope,
      doc: doc({ kind: "text", text: `No intraday options history for ${ticker} on ${served}.` }),
      notes: note ? [note] : undefined,
    };
  }

  const blocks: Block[] = [
    {
      kind: "head",
      title: field("ticker", ticker),
      right: fields(
        field("session", served),
        field("board", data?.live ? "live" : "closed", data?.live ? "accent" : undefined),
        field("cycles", String(data?.cycles ?? series.length)),
      ),
    },
    {
      kind: "table",
      head: ["CYCLE", "TIME", "CALL VOL", "PUT VOL", "P/C", "UNUSUAL", "PCTL 1Y", "ATM IV"],
      align: ["right", "left", "right", "right", "right", "right", "right", "right"],
      rows: series.map((point) => [
        cell(String(point.cycle)),
        cell(point.asOfEt ?? ""),
        cell(humanize(point.callVol, 1)),
        cell(humanize(point.putVol, 1)),
        cell(fixed(point.pcVol, 2)),
        cell(String(point.unusualCount ?? 0)),
        cell(fixed(point.maxPremiumPctl1y, 1)),
        cell(fixed(point.atmIv, 4)),
      ]),
    },
  ];

  const missing = data?.missingCycles ?? [];
  if (missing.length > 0) {
    blocks.push({
      kind: "text",
      text: `${missing.length === 1 ? "Cycle" : "Cycles"} ${missing.join(", ")} ${missing.length === 1 ? "was" : "were"} published but could not be read, so ${ticker}'s numbers there are unknown.`,
      tone: "dim",
    });
  }
  blocks.push({
    kind: "text",
    text: `Volumes are cumulative for the session, from chains delayed ${data?.delayMinutes ?? 15} minutes.`,
    tone: "dim",
  });

  return { json: envelope, doc: doc(...blocks) };
}

export const optionsCommand: CommandDef = {
  name: "options",
  summary: "End-of-day options positioning for one stock or ETF",
  usage: "sentisense options <ticker> [--intraday] [--session YYYY-MM-DD]",
  examples: [
    "sentisense options NVDA",
    "sentisense options SPY --full",
    "sentisense options NVDA --json",
    "sentisense options NVDA --intraday",
    "sentisense options SPY --session 2026-10-14",
  ],
  notes: [
    "End of day, not live: readings describe the latest completed session and refresh the",
    "following morning. Percentiles are against that ticker's own trailing history, so they",
    "compare a stock to its past self, never to another stock.",
    "Coverage is the most actively optioned names plus the tracked ETFs. A real ticker",
    "outside that set reports no coverage and exits 0, the same as any other empty result.",
    EMPTY_VERIFY_NOTE,
    EMPTY_VERIFY_NOTE_2,
    "A free key gets the full dossier for the first ten calls each month, then a headline",
    "preview. Calls that return no dossier do not count against that.",
    "--intraday shows one session's intraday series instead: the ticker's volumes, put/call",
    "ratio, unusual-contract count and ATM IV at every 15-minute cycle (PRO keys only).",
    "--session picks the session and implies --intraday; omitted, the latest one.",
  ],
  flags: {
    intraday: { type: "boolean", describe: "Show the session's intraday series, every 15-minute cycle (PRO)" },
    session: {
      type: "string",
      placeholder: "YYYY-MM-DD",
      describe: "Session for the intraday series (default: the latest)",
    },
  },
  async run({ args, client, full }) {
    const ticker = oneTicker(args, "options");
    const session = typeof args.flags.session === "string" ? args.flags.session : undefined;
    if (session !== undefined && !SESSION_PATTERN.test(session)) {
      throw new CliUsageError("--session must be a date, YYYY-MM-DD.", "for example: --session 2026-10-14");
    }
    if (args.flags.intraday === true || session !== undefined) {
      return intraday(client(), ticker, session);
    }

    const api = client();
    const envelope = await api.stocks.getOptionsSummary(ticker);
    const data = envelope.data;

    // No coverage is an empty result, not a failure, so it exits 0 like an empty window on
    // any other command. The exact envelope still goes out under --json.
    if (!data) {
      const note = await verifyTickerOnEmpty(api, ticker);
      return {
        json: envelope,
        doc: doc({ kind: "text", text: `No options coverage for ${ticker}.` }),
        notes: note ? [note] : undefined,
      };
    }

    // A FREE key past its monthly dossiers gets the headline preview, whose readings sit flat
    // on the payload rather than inside latest, context and oiWalls. Fall back to them so the
    // preview shows its readings instead of a row of n/a.
    const latest = data.latest ?? {};
    const context = data.context ?? {};
    const ivRank = context.ivRank1y ?? data.ivRank1y;
    const pcVol = latest.pcVol ?? data.pcVol;
    const maxPain = data.oiWalls?.maxPain ?? data.maxPain;
    const blocks: Block[] = [
      {
        kind: "head",
        title: field("ticker", ticker),
        right: fields(
          field("positioning", signed(data.sentiment, 2), direction(data.sentiment)),
          field("iv rank 1y", fixed(ivRank, 1)),
          field("put/call vol", fixed(pcVol, 2)),
        ),
      },
      {
        kind: "facts",
        items: fields(
          field("ATM IV", fixed(latest.atmIv ?? data.atmIv, 4)),
          field("Exp move 1d", fixed(latest.expectedMove1d ?? data.expectedMove1d, 4)),
          field("Skew 25d", signed(latest.skew25d, 4)),
          field("Call vol", humanize(latest.callVol, 1)),
          field("Put vol", humanize(latest.putVol, 1)),
          field("Notional", humanize(latest.notionalVol)),
        ),
      },
      {
        kind: "facts",
        items: fields(
          field("Max pain", fixed(maxPain, 0)),
          field("Wall expiry", data.oiWalls?.expiry ?? "n/a"),
          field("Call OI", humanize(latest.callOi, 1)),
          field("Put OI", humanize(latest.putOi, 1)),
          field("Contracts", humanize(latest.contracts, 0)),
        ),
      },
      {
        kind: "kv",
        items: fields(
          field("call walls", walls(data.oiWalls?.callWalls)),
          field("put walls", walls(data.oiWalls?.putWalls)),
        ),
      },
    ];

    if (full) {
      blocks.push({
        kind: "kv",
        items: fields(
          field("term structure", `60d ${fixed(latest.atmIv60, 4)}   90d ${fixed(latest.atmIv90, 4)}`),
          field("net delta", humanize(latest.netDelta, 1)),
          field("put/call OI", fixed(latest.pcOi, 2)),
          field("pc vol percentile 1y", fixed(context.pcVolPctl1y ?? data.pcVolPctl1y, 1)),
          field("skew percentile 1y", fixed(context.skewPctl1y, 1)),
          field("observations 1y", fixed(context.observations1y, 0)),
        ),
      });
    }

    const unusual = data.unusual ?? [];
    if (unusual.length > 0) {
      blocks.push({ kind: "blank" });
      blocks.push({
        kind: "table",
        head: ["CONTRACT", "TYPE", "STRIKE", "EXPIRY", "DTE", "VOLUME", "OI", "VOL/OI", "PREMIUM"],
        align: ["left", "left", "right", "left", "right", "right", "right", "right", "right"],
        rows: unusual.map((row) => [
          cell(row.contract ?? ""),
          cell(row.type ?? "", contractTone(row.type)),
          cell(fixed(row.strike, 0)),
          cell(row.expiry ?? ""),
          cell(row.dte === undefined ? "" : String(row.dte)),
          cell(humanize(row.volume, 0)),
          cell(humanize(row.oi, 0)),
          cell(fixed(row.volOiRatio, 1)),
          cell(humanize(row.premium)),
        ]),
      });
    }

    blocks.push({
      kind: "text",
      text: `session of ${data.asOf ?? latest.date ?? "an unrecorded date"}`,
      tone: "dim",
    });

    if (envelope.isPreview) {
      blocks.push({
        kind: "text",
        text: "Preview response: the free monthly dossier allowance is spent, so only the headline readings are shown.",
        tone: "dim",
      });
    }

    return { json: envelope, doc: doc(...blocks) };
  },
};
