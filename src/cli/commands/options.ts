import type { SentiSense } from "../../client.js";
import { sampleNote } from "../sample.js";
import type {
  DossierAllowance,
  OptionsHighlight,
  OptionsHistoryWindow,
  OptionsOverviewRow,
  OptionsUnusualContract,
  OptionsWall,
} from "../../types.js";
import type { CommandDef, CommandResult } from "../command.js";
import { CliUsageError } from "../errors.js";
import type { ParsedArgs } from "../parse.js";
import { EMPTY_VERIFY_NOTE, EMPTY_VERIFY_NOTE_2, optionalTicker, verifyTickerOnEmpty } from "../ticker.js";
import { cell, doc, field, fields, type Block } from "../render/doc.js";
import { dateFromSeconds, direction, fixed, humanize, signed, strike, truncate } from "../render/num.js";

const SESSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Radar rows printed when `--limit` is not given. */
const DEFAULT_RADAR_ROWS = 15;

/** History sessions printed when `--limit` is not given. */
const DEFAULT_HISTORY_ROWS = 20;

/**
 * Every window the history route accepts. `satisfies` fails the build when the SDK's
 * `OptionsHistoryWindow` union gains or loses a value and this list does not follow.
 */
const HISTORY_WINDOWS = { "1y": true, "2y": true, "5y": true } satisfies Record<OptionsHistoryWindow, true>;

function isHistoryWindow(value: string): value is OptionsHistoryWindow {
  return Object.prototype.hasOwnProperty.call(HISTORY_WINDOWS, value);
}

/** Contract side arrives lower case on the wire, so compare without assuming a case. */
function contractTone(type: string | undefined): "up" | "down" | undefined {
  const side = type?.toUpperCase();
  if (side === "CALL") return "up";
  if (side === "PUT") return "down";
  return undefined;
}

function walls(rows: OptionsWall[] | undefined): string {
  if (!rows || rows.length === 0) return "n/a";
  return rows.map((wall) => `${strike(wall.strike)} (${humanize(wall.oi, 1)})`).join("  ");
}

/** A count change with its sign either way: +4.7k, -120. */
function signedCount(value: number | undefined): string {
  const text = humanize(value, 1);
  return typeof value === "number" && value > 0 ? `+${text}` : text;
}

/** The one line a free key's reader needs about the monthly dossier allowance. */
function allowanceLine(allowance: DossierAllowance | undefined): Block | undefined {
  if (!allowance) return undefined;
  return {
    kind: "text",
    text: `${allowance.remaining} of ${allowance.limit} full dossiers left this month, resets ${dateFromSeconds(allowance.resetsAt)}.`,
    tone: "dim",
  };
}

function hasFollowUp(row: OptionsUnusualContract): boolean {
  return (
    row.oiPrior !== undefined ||
    row.oiNext !== undefined ||
    row.oiChange !== undefined ||
    row.oiConfirmation !== undefined
  );
}

// ── Which view ─────────────────────────────────────────────

/** What to run instead, for a per-ticker flag given without a ticker. */
const TICKER_EXAMPLE: Record<string, string> = {
  "--history": "sentisense options NVDA --history",
  "--window": "sentisense options NVDA --window 2y",
  "--intraday": "sentisense options NVDA --intraday",
  "--session": "sentisense options NVDA --session 2026-10-15",
};

type View =
  | { kind: "radar"; etfs: boolean; limit: number | undefined }
  | { kind: "dossier"; ticker: string }
  | { kind: "history"; ticker: string; window: OptionsHistoryWindow | undefined; limit: number | undefined }
  | { kind: "intraday"; ticker: string; session: string | undefined };

/**
 * Settles the view from the arguments before any request is made.
 *
 * The views read different endpoints, so a flag that belongs to another view is a usage error
 * rather than something to drop quietly: a dropped `--history` would answer a different
 * question than the one asked, in the same confident layout.
 */
function pickView(args: ParsedArgs): View {
  const ticker = optionalTicker(args, "options");
  // No ticker at all is the Radar. A ticker that was passed but is empty, as in
  // `sentisense options "$TICKER"` with the variable unset, is a mistake: answering it with the
  // market-wide board would hand a script a confident answer to a question it never asked.
  if (args.positionals.length > 0 && args.positionals[0].trim() === "") {
    throw new CliUsageError("options needs a ticker.", "for example: sentisense options NVDA");
  }
  const flags = args.flags;
  const session = typeof flags.session === "string" ? flags.session : undefined;
  const rawWindow = typeof flags.window === "string" ? flags.window : undefined;
  const limit = typeof flags.limit === "number" ? flags.limit : undefined;
  const etfs = flags.etfs === true;

  if (session !== undefined && !SESSION_PATTERN.test(session)) {
    throw new CliUsageError("--session must be a date, YYYY-MM-DD.", "for example: --session 2026-10-15");
  }
  if (rawWindow !== undefined && !isHistoryWindow(rawWindow)) {
    throw new CliUsageError(`--window takes 1y, 2y or 5y, got "${rawWindow}".`, "for example: --window 2y");
  }
  const window = rawWindow as OptionsHistoryWindow | undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    throw new CliUsageError("--limit must be a whole number, at least 1.", "for example: --limit 25");
  }

  const intradayFlag = flags.intraday === true ? "--intraday" : session !== undefined ? "--session" : undefined;
  const historyFlag = flags.history === true ? "--history" : window !== undefined ? "--window" : undefined;

  if (intradayFlag && historyFlag) {
    throw new CliUsageError(
      `${historyFlag} and ${intradayFlag} do not go together.`,
      "pass one or the other: --window implies --history, and --session implies --intraday.",
    );
  }
  if (etfs && (intradayFlag || historyFlag)) {
    throw new CliUsageError(
      `--etfs and ${intradayFlag ?? historyFlag} do not go together.`,
      "--etfs picks the Radar's ETF board; --history and --intraday read one ticker.",
    );
  }
  if (etfs && ticker) {
    throw new CliUsageError(
      "--etfs picks the Radar's ETF board, which takes no ticker.",
      `drop the ticker for the ETF board, or drop --etfs for ${ticker}'s dossier.`,
    );
  }

  if (!ticker) {
    const needsTicker = intradayFlag ?? historyFlag;
    if (needsTicker) {
      throw new CliUsageError(`${needsTicker} needs a ticker.`, `for example: ${TICKER_EXAMPLE[needsTicker]}`);
    }
    return { kind: "radar", etfs, limit };
  }

  if (historyFlag) return { kind: "history", ticker, window, limit };
  if (limit !== undefined) {
    throw new CliUsageError(
      "--limit applies to the Radar and to --history.",
      `drop it, or run "sentisense options ${ticker} --history --limit ${limit}".`,
    );
  }
  if (intradayFlag) return { kind: "intraday", ticker, session };
  return { kind: "dossier", ticker };
}

// ── Radar ──────────────────────────────────────────────────

interface Board {
  name: string;
  rows: OptionsOverviewRow[];
  highlights: OptionsHighlight[];
  medianIvRank?: number;
  marketPcVol?: number;
  extremeCount?: number;
  coverageCount?: number;
  /** The full board's size when the server says it is larger than what was served. */
  totalCount?: number;
  /** False when the build carried no such board at all. */
  present: boolean;
}

/**
 * The market-wide Radar: one board's aggregates, its ranked rows and its session highlights.
 *
 * The stock and ETF boards are ranked separately, against each ticker's own history, so this
 * prints one of them and never a merge. A free key's preview is an answer, so it exits 0 and
 * says what the cut is; `data: null` before the first build is a plain message, not an error.
 */
async function radar(
  api: SentiSense,
  etfs: boolean,
  limit: number | undefined,
  full: boolean,
): Promise<CommandResult> {
  const envelope = await api.options.getOverview();
  const data = envelope.data;

  if (!data) {
    return {
      json: envelope,
      doc: doc({
        kind: "text",
        text: "No options board yet: the Radar is built after each session closes, and no build has been published.",
      }),
    };
  }

  const board: Board = etfs
    ? {
        name: "ETFs",
        rows: data.etfRows ?? [],
        highlights: data.etfHighlights ?? [],
        medianIvRank: data.etfMedianIvRank,
        marketPcVol: data.etfMarketPcVol,
        extremeCount: data.etfExtremeCount,
        coverageCount: data.etfCoverageCount,
        totalCount: data.etfTotalCount,
        present: data.etfRows !== undefined,
      }
    : {
        name: "stocks",
        rows: data.rows ?? [],
        highlights: data.highlights ?? [],
        medianIvRank: data.medianIvRank,
        marketPcVol: data.marketPcVol,
        extremeCount: data.extremeCount,
        coverageCount: data.coverageCount,
        totalCount: envelope.totalCount,
        present: true,
      };

  const extreme =
    board.extremeCount === undefined
      ? "n/a"
      : board.coverageCount === undefined
        ? String(board.extremeCount)
        : `${board.extremeCount} of ${board.coverageCount}`;

  const blocks: Block[] = [
    {
      kind: "head",
      title: field("board", `Options Radar, ${board.name}`),
      right: fields(field("session", data.asOf ?? "n/a")),
    },
  ];

  if (!board.present) {
    blocks.push({ kind: "text", text: "This build has no ETF board." });
    return { json: envelope, doc: doc(...blocks) };
  }

  blocks.push({
    kind: "facts",
    items: fields(
      field("Median IV rank", fixed(board.medianIvRank, 1)),
      field("Market put/call", fixed(board.marketPcVol, 2)),
      field("Names at an extreme", extreme),
    ),
  });

  const served = board.rows.length;
  const shown = full ? board.rows : board.rows.slice(0, limit ?? DEFAULT_RADAR_ROWS);

  if (served === 0) {
    blocks.push({ kind: "text", text: `No rows on the ${board.name} board in this build.` });
  } else {
    blocks.push({ kind: "blank" });
    blocks.push({
      kind: "table",
      head: ["#", "TICKER", "NAME", "SCORE", "SENT", "P/C", "P/C PCTL", "IV RANK", "SKEW", "SKEW PCTL", "NOTIONAL"],
      align: ["right", "left", "left", "right", "right", "right", "right", "right", "right", "right", "right"],
      rows: shown.map((row, index) => [
        cell(String(index + 1)),
        cell(row.ticker ?? ""),
        cell(truncate(row.name ?? "", full ? 40 : 18)),
        cell(fixed(row.interestScore, 1)),
        cell(signed(row.sentiment, 2), direction(row.sentiment)),
        cell(fixed(row.pcVol, 2)),
        cell(fixed(row.pcVolPctl1y, 1)),
        cell(fixed(row.ivRank1y, 1)),
        cell(signed(row.skew25d, 4)),
        cell(fixed(row.skewPctl1y, 1)),
        cell(humanize(row.notionalVol)),
      ]),
    });

    // Every truncation names both numbers: what was printed against what was served, and the
    // full board when the server reports one larger than what it sent.
    const fullBoard = board.totalCount !== undefined && board.totalCount > served ? board.totalCount : undefined;
    if (shown.length < served) {
      blocks.push({
        kind: "text",
        text: fullBoard
          ? `Showing ${shown.length} of ${served} served; the full board has ${fullBoard} names. Add --full for every served row.`
          : `Showing ${shown.length} of ${served} names. Add --full, or --limit N, for more.`,
        tone: "dim",
      });
    } else if (fullBoard) {
      blocks.push({
        kind: "text",
        text: `Showing all ${served} served; the full board has ${fullBoard} names.`,
        tone: "dim",
      });
    }
  }

  if (board.highlights.length > 0) {
    blocks.push({ kind: "blank" });
    blocks.push({ kind: "text", text: "Session highlights, each ticker's highest-premium unusual contract:" });
    blocks.push({
      kind: "table",
      head: ["TICKER", "CONTRACT", "TYPE", "VOLUME", "VOL/OI", "PREMIUM"],
      align: ["left", "left", "left", "right", "right", "right"],
      rows: board.highlights.map((row) => [
        cell(row.ticker ?? ""),
        cell(row.contract ?? ""),
        cell(row.type ?? "", contractTone(row.type)),
        cell(humanize(row.volume, 0)),
        cell(fixed(row.volOiRatio, 1)),
        cell(humanize(row.premium)),
      ]),
    });
  }

  if (!etfs && (data.etfRows?.length ?? 0) > 0) {
    blocks.push({ kind: "text", text: "The ETF board is ranked separately: add --etfs.", tone: "dim" });
  }

  if (envelope.isPreview) {
    blocks.push({
      kind: "text",
      text: "Preview response: a free key gets the top 25 rows and the top 3 highlights of each board, with every aggregate. A PRO key gets the whole board.",
      tone: "dim",
    });
  }

  return { json: envelope, doc: doc(...blocks) };
}

// ── History ────────────────────────────────────────────────

/**
 * One ticker's daily sessions, newest first.
 *
 * The window served is not always the one asked for, since a free key is served `1y` for
 * every ticker but the sample companies, so the output prints what came back rather than
 * what was requested. An empty series is how this route reports no coverage.
 */
async function history(
  api: SentiSense,
  ticker: string,
  window: OptionsHistoryWindow | undefined,
  limit: number | undefined,
  full: boolean,
): Promise<CommandResult> {
  const envelope = await api.stocks.getOptionsHistory(ticker, window === undefined ? undefined : { window });
  const data = envelope.data;
  const series = data?.series ?? [];

  if (series.length === 0) {
    const note = await verifyTickerOnEmpty(api, ticker);
    return {
      json: envelope,
      doc: doc({ kind: "text", text: `No options coverage for ${ticker}.` }),
      notes: note ? [note] : undefined,
    };
  }

  const served = data?.window ?? "n/a";
  const count = full ? series.length : Math.min(limit ?? DEFAULT_HISTORY_ROWS, series.length);
  const newest = series.slice(series.length - count).reverse();

  const blocks: Block[] = [
    {
      kind: "head",
      title: field("ticker", ticker),
      right: fields(field("window", served), field("sessions", String(series.length))),
    },
    {
      kind: "table",
      head: ["DATE", "CALL VOL", "PUT VOL", "P/C", "CALL OI", "PUT OI", "ATM IV", "SKEW", "MAX UNUSUAL"],
      align: ["left", "right", "right", "right", "right", "right", "right", "right", "right"],
      rows: newest.map((row) => [
        cell(row.date ?? ""),
        cell(humanize(row.callVol, 1)),
        cell(humanize(row.putVol, 1)),
        cell(fixed(row.pcVol, 2)),
        cell(humanize(row.callOi, 1)),
        cell(humanize(row.putOi, 1)),
        cell(fixed(row.atmIv, 4)),
        cell(signed(row.skew25d, 4)),
        cell(humanize(row.maxUnusualPremium)),
      ]),
    },
    {
      kind: "text",
      text:
        count < series.length
          ? `Newest ${count} of ${series.length} sessions in the ${served} window. Add --full, or --limit N, for more.`
          : `Newest ${count} of ${series.length} sessions in the ${served} window.`,
      tone: "dim",
    },
  ];

  if (window !== undefined && served !== window) {
    blocks.push({
      kind: "text",
      text: `Asked for ${window}, served ${served}: a free key is served 1y for every ticker except the sample companies.`,
      tone: "dim",
    });
  }
  blocks.push({
    kind: "text",
    text: "Open interest is the count going into each session, at the previous close.",
    tone: "dim",
  });

  return { json: envelope, doc: doc(...blocks, sampleNote(envelope, ticker)) };
}

// ── Intraday ───────────────────────────────────────────────

/**
 * One session's intraday series, every 15-minute cycle the ticker was on the board.
 *
 * PRO, or a sample company on a free key. Any other free call gets a preview with no payload,
 * which is an answer rather than a failure, so it exits 0 and says why the table is missing.
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
    return { json: envelope, doc: doc(...lines, sampleNote(envelope, ticker)) };
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
      text: `${missing.length === 1 ? "Cycle" : "Cycles"} ${missing.join(", ")} ${missing.length === 1 ? "has" : "have"} no stored history (no board was published, or its history was lost), so ${ticker}'s numbers there are unknown.`,
      tone: "dim",
    });
  }
  blocks.push({
    kind: "text",
    text: `Volumes are cumulative for the session, from chains delayed ${data?.delayMinutes ?? 15} minutes.`,
    tone: "dim",
  });

  return { json: envelope, doc: doc(...blocks, sampleNote(envelope, ticker)) };
}

// ── Dossier ────────────────────────────────────────────────

/**
 * The dossier's readings sit on three scales and print as bare numbers, so one line says which
 * is which. Each scale is the one the API documents for that field.
 */
const DOSSIER_SCALES =
  "positioning runs -1 to +1; IV rank 0 to 100; ATM IV, expected move and skew are fractions (0.05 is 5%, or 5 IV points for skew).";

async function dossier(api: SentiSense, ticker: string, full: boolean): Promise<CommandResult> {
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
  const oiWalls = data.oiWalls ?? {};
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
  ];

  // A delisted symbol's dossier is the last one on record, and nothing newer will replace it.
  // Said first, because every reading below has to be read in that light. It is dated by its
  // own `asOf`, never assumed to be the final trading session: the last stored snapshot can
  // predate the delisting.
  if (data.listingStatus === "DELISTED") {
    const when = data.delistedDate ? ` (${data.delistedDate})` : "";
    const asOf = data.asOf ? `, as of ${data.asOf}` : "";
    blocks.push({
      kind: "text",
      text: `${ticker} is delisted${when}: this is the last dossier on record${asOf}.`,
    });
  }

  blocks.push(
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
        field("Max pain", strike(maxPain)),
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
  );

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
    // A block of its own, so the lines above keep the alignment they always had.
    blocks.push({
      kind: "kv",
      items: fields(
        field("pc vol percentile 5y", fixed(context.pcVolPctl5y, 1)),
        field("put/call OI percentile 1y", fixed(context.pcOiPctl1y, 1)),
        field("unusual premium percentile 1y", fixed(context.unusualPremiumPctl1y, 1)),
        field("exp move 5d", fixed(latest.expectedMove5d, 4)),
        field("exp move 20d", fixed(latest.expectedMove20d, 4)),
        field("wall expiry OI", `calls ${humanize(oiWalls.totalCallOi, 1)}   puts ${humanize(oiWalls.totalPutOi, 1)}`),
        field("OI at max pain", `calls ${humanize(oiWalls.maxPainCallOi, 1)}   puts ${humanize(oiWalls.maxPainPutOi, 1)}`),
      ),
    });
  }

  blocks.push({ kind: "text", text: DOSSIER_SCALES, tone: "dim" });

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
        cell(strike(row.strike)),
        cell(row.expiry ?? ""),
        cell(row.dte === undefined ? "" : String(row.dte)),
        cell(humanize(row.volume, 0)),
        cell(humanize(row.oi, 0)),
        cell(fixed(row.volOiRatio, 1)),
        cell(humanize(row.premium)),
      ]),
    });

    // The follow-up can resolve against the next session's chain or against a revised reading
    // of the same session, so the heading names neither; `oiVintage` says which, per row.
    const followed = full ? unusual.filter(hasFollowUp) : [];
    if (followed.length > 0) {
      const vintage = followed.some((row) => row.oiVintage !== undefined);
      blocks.push({ kind: "blank" });
      blocks.push({ kind: "text", text: "Open interest follow-up on those contracts:" });
      blocks.push({
        kind: "table",
        head: ["CONTRACT", "OI PRIOR", "OI NEXT", "OI CHANGE", "FOLLOW-UP", ...(vintage ? ["VINTAGE"] : [])],
        align: ["left", "right", "right", "right", "left", "left"],
        rows: followed.map((row) => [
          cell(row.contract ?? ""),
          cell(humanize(row.oiPrior, 1)),
          cell(humanize(row.oiNext, 1)),
          cell(signedCount(row.oiChange)),
          cell(row.oiConfirmation ?? "n/a"),
          ...(vintage ? [cell(row.oiVintage ?? "n/a")] : []),
        ]),
      });
    }
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

  return {
    json: envelope,
    doc: doc(...blocks, allowanceLine(envelope.dossierAllowance), sampleNote(envelope, ticker)),
  };
}

// ── Command ────────────────────────────────────────────────

export const optionsCommand: CommandDef = {
  name: "options",
  summary: "End-of-day options: the market Radar, or one stock or ETF's positioning and history",
  usage:
    "sentisense options [--etfs] [--limit N] | sentisense options <ticker> [--history [--window 1y|2y|5y] [--limit N] | --intraday [--session YYYY-MM-DD]]",
  examples: [
    "sentisense options",
    "sentisense options --etfs --limit 25",
    "sentisense options NVDA",
    "sentisense options SPY --full",
    "sentisense options NVDA --history --window 2y",
    "sentisense options NVDA --json",
    "sentisense options NVDA --intraday",
    "sentisense options SPY --session 2026-10-15",
  ],
  notes: [
    "End of day, not live: readings describe the latest completed session and refresh the",
    "following morning. Percentiles are against that ticker's own trailing history, so they",
    "compare a stock to its past self, never to another stock.",
    "With no ticker it prints the Radar: the session's market aggregates, the stock board",
    "ranked by interest score, and the session highlights. --etfs shows the ETF board, which",
    "is ranked separately. A free key gets the top 25 rows and the top 3 highlights of each",
    "board, with every aggregate. --limit sets the rows printed (default 15).",
    "Coverage is the most actively optioned names plus the tracked ETFs. A real ticker",
    "outside that set reports no coverage and exits 0, the same as any other empty result.",
    EMPTY_VERIFY_NOTE,
    EMPTY_VERIFY_NOTE_2,
    "A free key gets the full dossier for the first ten calls each month, then a headline",
    "preview. Calls that return no dossier do not count against that. Sample companies are",
    "always full and spend none of the ten. On a free key the dossier says how many are left",
    "and when the count resets, whenever the API reports the count.",
    "--history shows the ticker's daily sessions, newest first (default 20, --limit changes",
    "it). --window picks 1y, 2y or 5y and implies --history. A free key is served 1y for every",
    "ticker except the sample companies, and the output names the window it was served.",
    "--intraday shows one session's intraday series instead: the ticker's volumes, put/call",
    "ratio, unusual-contract count and ATM IV at every 15-minute cycle (PRO keys and sample companies).",
    "--session picks the session and implies --intraday; omitted, the latest one.",
    "--full adds every served row to the Radar and --history, and more readings to a dossier.",
    "--limit and --etfs choose what the plain view prints; they do not trim --json, which prints",
    "the whole API response: for the Radar that is both boards and every served row, a large body.",
  ],
  flags: {
    etfs: { type: "boolean", describe: "With no ticker, show the Radar's ETF board instead of the stock board" },
    limit: {
      type: "number",
      placeholder: "N",
      describe: `Rows to print: the Radar (default ${DEFAULT_RADAR_ROWS}) or --history (default ${DEFAULT_HISTORY_ROWS})`,
    },
    history: { type: "boolean", describe: "Show the ticker's daily sessions, newest first" },
    window: {
      type: "string",
      placeholder: "1y|2y|5y",
      describe: "Window for --history (default 1y); implies --history",
    },
    intraday: { type: "boolean", describe: "Show the session's intraday series, every 15-minute cycle (PRO or a sample company)" },
    session: {
      type: "string",
      placeholder: "YYYY-MM-DD",
      describe: "Session for the intraday series (default: the latest)",
    },
  },
  async run({ args, client, full }) {
    const view = pickView(args);
    switch (view.kind) {
      case "radar":
        return radar(client(), view.etfs, view.limit, full);
      case "history":
        return history(client(), view.ticker, view.window, view.limit, full);
      case "intraday":
        return intraday(client(), view.ticker, view.session);
      case "dossier":
        return dossier(client(), view.ticker, full);
    }
  },
};
