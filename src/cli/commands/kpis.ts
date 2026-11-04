import type { SentiSense } from "../../client.js";
import { NotFoundError } from "../../errors.js";
import type { CompanyKpisData, KpiDataPoint, KpiSeries, PreviewResponse } from "../../types.js";
import type { CommandDef, CommandResult } from "../command.js";
import { CliCommandError, CliUsageError, EXIT } from "../errors.js";
import { sampleNote } from "../sample.js";
import {
  EMPTY_VERIFY_NOTE,
  EMPTY_VERIFY_NOTE_2,
  oneTicker,
  rejectPositionals,
  verifyTickerOnEmpty,
} from "../ticker.js";
import { cell, doc, field, fields, type Block, type Cell } from "../render/doc.js";
import { ABSENT, direction, humanize, money, percent, signed, signedPercent, truncate } from "../render/num.js";

const DEFAULT_PERIODS = 12;
const DEFAULT_COVERAGE_ROWS = 20;

/** Newest first. Dates are ISO, so a string compare orders them. */
function newestFirst(values: KpiDataPoint[]): KpiDataPoint[] {
  return [...values].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * The label of the same period one year earlier, in the series' own labelling: "Q3 2026"
 * becomes "Q3 2025", "Q2 FY2026" becomes "Q2 FY2025", "H1 2026" becomes "H1 2025".
 *
 * Matching on the label rather than on a date window keeps the comparison inside one
 * labelling scheme, so a fiscal quarter is never set against a calendar one.
 */
export function yearAgoLabel(period: string): string | undefined {
  const match = /(\d{4})/.exec(period);
  if (!match) return undefined;
  const year = Number(match[1]);
  return `${period.slice(0, match.index)}${year - 1}${period.slice(match.index + 4)}`;
}

/**
 * Change against the same period a year earlier, computed from this series' values only.
 *
 * A percent series moves in points, since a percentage change of a margin reads as nonsense.
 * Anything else is a percentage change, and only off a positive base: off zero or a loss it
 * has no meaningful sign, so it prints as absent rather than as a misleading number.
 */
export function yearOverYear(series: KpiSeries, point: KpiDataPoint): Cell {
  const label = yearAgoLabel(point.period);
  const prior = label === undefined ? undefined : series.values.find((value) => value.period === label);
  if (!prior || !Number.isFinite(prior.value) || !Number.isFinite(point.value)) return cell(ABSENT);
  if (series.unit === "percent") {
    const diff = point.value - prior.value;
    return cell(`${signed(diff, 1)} pts`, direction(diff));
  }
  if (prior.value <= 0) return cell(ABSENT);
  const change = ((point.value - prior.value) / prior.value) * 100;
  return cell(signedPercent(change, 1), direction(change));
}

/** A value with its unit: $20.56B, $0.22, 49.7%, 486.53k vehicles, 13.7 GWh, 1.2B EUR. */
export function formatKpiValue(value: number, series: Pick<KpiSeries, "unit" | "displayFormat">): string {
  if (!Number.isFinite(value)) return ABSENT;
  const { unit, displayFormat } = series;
  if (unit === "percent") return percent(value, 1);
  if (unit === "USD") return displayFormat === "currency" ? money(value) : `$${humanize(value)}`;
  if (/^[A-Z]{3}$/.test(unit)) {
    return displayFormat === "currency" ? `${value.toFixed(2)} ${unit}` : `${humanize(value)} ${unit}`;
  }
  return unit ? `${humanize(value)} ${unit}` : humanize(value);
}

/**
 * Turns the 404 a ticker without curated KPIs gets into the answer the other commands give:
 * an unknown symbol exits 4 as a typo, a real company without coverage exits 4 saying so.
 */
async function noCoverage(api: SentiSense, ticker: string): Promise<never> {
  await verifyTickerOnEmpty(api, ticker);
  throw new CliCommandError(
    `${ticker} has no curated KPI coverage yet.`,
    'run "sentisense kpis --coverage" for the tickers that have it.',
    EXIT.NOT_FOUND,
  );
}

async function orNoCoverage<T>(api: SentiSense, ticker: string, request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof NotFoundError) return noCoverage(api, ticker);
    throw error;
  }
}

export const kpisCommand: CommandDef = {
  name: "kpis",
  summary: "Company KPIs from earnings filings: segment revenue, deliveries, subscribers",
  usage: "sentisense kpis <ticker> [--series ID | --types] | sentisense kpis --coverage",
  examples: [
    "sentisense kpis TSLA",
    "sentisense kpis TSLA --series vehicle_deliveries",
    "sentisense kpis TSLA --types",
    "sentisense kpis --coverage --full",
    "sentisense kpis TSLA --json",
  ],
  notes: [
    "One row per series: its latest reported period and value, and the change from the same",
    "period a year earlier, computed only from that series' own values. A percent series",
    "changes in points. Discontinued series are hidden unless --full.",
    "--series ID prints that series' periods, newest first. The ids are in the first column.",
    "--types lists the series without their values, on any key and at no quota cost.",
    "--coverage lists every covered ticker and marks the sample companies, whose full KPI",
    "series a free key can read. Other companies return the series list only on a free key;",
    "PRO returns every series in full.",
    "A ticker without KPI coverage exits 4 and says so; an unknown symbol exits 4 as a typo.",
    EMPTY_VERIFY_NOTE,
    EMPTY_VERIFY_NOTE_2,
  ],
  flags: {
    series: { type: "string", placeholder: "ID", describe: "Print one series' periods, newest first" },
    types: { type: "boolean", describe: "List the series without their values (free on any key)" },
    coverage: { type: "boolean", describe: "List every ticker with KPI coverage" },
  },
  async run({ args, client, full }) {
    if (args.flags.coverage === true) {
      rejectPositionals(args, "kpis --coverage");
      return coverageRun(client(), full);
    }
    const ticker = oneTicker(args, "kpis");
    const series = typeof args.flags.series === "string" ? args.flags.series : undefined;
    if (series !== undefined && args.flags.types === true) {
      throw new CliUsageError("--series and --types do not go together.", "pass one or the other.");
    }
    const api = client();
    if (args.flags.types === true) return typesRun(api, ticker);

    const envelope = await orNoCoverage(api, ticker, api.stocks.getKpis(ticker));
    return series === undefined ? summaryRun(envelope, ticker, full) : seriesRun(envelope, ticker, series, full);
  },
};

function headBlock(ticker: string, data: CompanyKpisData | undefined, right: Array<ReturnType<typeof field> | undefined>): Block {
  return {
    kind: "head",
    title: field("ticker", ticker),
    subtitle: data?.companyName ? field("company", data.companyName) : undefined,
    right: fields(...right),
  };
}

/**
 * What a free key on a locked company gets back: the metadata, and an empty `kpis` list.
 * That is an answer, not a failure, so it exits 0 and says where the numbers are.
 */
function lockedBlocks(envelope: PreviewResponse<CompanyKpisData>, ticker: string): Block[] {
  if (!envelope.isPreview) return [];
  return [
    {
      kind: "text",
      text: "Preview response: KPI values for this company are PRO. A free key gets the full series for the sample companies.",
      tone: "dim",
    },
    { kind: "text", text: `Run "sentisense kpis ${ticker} --types" for the series this company reports.`, tone: "dim" },
  ];
}

function summaryRun(envelope: PreviewResponse<CompanyKpisData>, ticker: string, full: boolean): CommandResult {
  const data = envelope.data;
  const all = data?.kpis ?? [];
  const discontinued = all.filter((series) => series.discontinued === true);
  const shown = full ? all : all.filter((series) => series.discontinued !== true);

  const blocks: Block[] = [
    headBlock(ticker, data, [
      // A preview's empty list is a gate, not a count, so it prints no "series: 0".
      envelope.isPreview && all.length === 0 ? undefined : field("series", String(all.length)),
      data?.lastUpdated ? field("updated", data.lastUpdated.slice(0, 10)) : undefined,
    ]),
  ];

  if (shown.length > 0) {
    blocks.push({
      kind: "table",
      head: ["ID", "SERIES", "PERIOD", "VALUE", "YOY"],
      align: ["left", "left", "left", "right", "right"],
      rows: shown.map((series): Cell[] => {
        const latest = newestFirst(series.values)[0];
        const name = `${series.name}${series.discontinued ? " (discontinued)" : ""}`;
        return [
          // Never truncated: the id is what --series takes, so it has to copy and paste whole.
          cell(series.id),
          cell(truncate(name, full ? 60 : 32), series.discontinued ? "dim" : undefined),
          cell(latest ? `${latest.period}${latest.isEstimate ? " (prelim)" : ""}` : ABSENT),
          cell(latest ? formatKpiValue(latest.value, series) : ABSENT),
          latest ? yearOverYear(series, latest) : cell(ABSENT),
        ];
      }),
    });
    if (!full && discontinued.length > 0) {
      blocks.push({
        kind: "text",
        text: `${discontinued.length} discontinued series hidden. Add --full to show them.`,
        tone: "dim",
      });
    }
  } else if (!envelope.isPreview) {
    blocks.push({ kind: "text", text: "No KPI series reported for this company." });
  }

  blocks.push(...lockedBlocks(envelope, ticker));
  return { json: envelope, doc: doc(...blocks, sampleNote(envelope, ticker)) };
}

function seriesRun(
  envelope: PreviewResponse<CompanyKpisData>,
  ticker: string,
  id: string,
  full: boolean,
): CommandResult {
  const data = envelope.data;
  if (envelope.isPreview && (data?.kpis ?? []).length === 0) {
    const blocks: Block[] = [headBlock(ticker, data, [field("series", id)]), ...lockedBlocks(envelope, ticker)];
    return { json: envelope, doc: doc(...blocks, sampleNote(envelope, ticker)) };
  }

  const series = (data?.kpis ?? []).find((candidate) => candidate.id === id);
  if (!series) {
    throw new CliCommandError(
      `${ticker} has no KPI series "${id}".`,
      `run "sentisense kpis ${ticker} --types" for its series ids.`,
      EXIT.NOT_FOUND,
    );
  }

  const values = newestFirst(series.values);
  const shown = full ? values : values.slice(0, DEFAULT_PERIODS);
  const blocks: Block[] = [
    headBlock(ticker, data, [field("series", series.name), field("periods", String(values.length))]),
  ];
  if (series.discontinued) {
    blocks.push({
      kind: "text",
      text: `Discontinued${series.discontinuedNote ? `: ${series.discontinuedNote}` : "."}`,
      tone: "dim",
    });
  }
  if (shown.length === 0) {
    blocks.push({ kind: "text", text: "No reported periods in this series." });
  } else {
    blocks.push({
      kind: "table",
      head: ["PERIOD", "DATE", "VALUE", "YOY", ""],
      align: ["left", "left", "right", "right", "left"],
      rows: shown.map((point) => [
        cell(point.period),
        cell(point.date),
        cell(formatKpiValue(point.value, series)),
        yearOverYear(series, point),
        cell(point.isEstimate ? "prelim" : ""),
      ]),
    });
    if (shown.length < values.length) {
      blocks.push({
        kind: "text",
        text: `Showing ${shown.length} of ${values.length} periods. Add --full for the rest.`,
        tone: "dim",
      });
    }
  }
  if (series.sourceRef) blocks.push({ kind: "text", text: `Source: ${series.sourceRef}`, tone: "dim" });

  return { json: envelope, doc: doc(...blocks, sampleNote(envelope, ticker)) };
}

async function typesRun(api: SentiSense, ticker: string): Promise<CommandResult> {
  const types = await orNoCoverage(api, ticker, api.stocks.getKpiTypes(ticker));
  const blocks: Block[] = [{ kind: "head", title: field("ticker", ticker), right: [field("series", String(types.length))] }];
  if (types.length === 0) {
    blocks.push({ kind: "text", text: "No KPI series listed for this company." });
  } else {
    blocks.push({
      kind: "table",
      head: ["ID", "SERIES", "CATEGORY"],
      rows: types.map((entry) => [cell(entry.id), cell(entry.name), cell(entry.category)]),
    });
  }
  return { json: types, doc: doc(...blocks) };
}

/**
 * Without --full this prints the sample companies, which are the rows a free key can read in
 * full, and says how many covered tickers sit behind them. With --full it prints every one.
 */
async function coverageRun(api: SentiSense, full: boolean): Promise<CommandResult> {
  const response = await api.stocks.listKpiCoverage();
  const rows = response.tickers ?? [];
  const samples = rows.filter((row) => row.sampleCompany === true);
  const count = response.count ?? rows.length;
  const shown = full ? rows : samples.length > 0 ? samples : rows.slice(0, DEFAULT_COVERAGE_ROWS);

  const blocks: Block[] = [
    {
      kind: "head",
      title: field("kpi coverage", `${count} tickers`),
      right: fields(samples.length > 0 ? field("sample companies", String(samples.length)) : undefined),
    },
  ];
  if (shown.length === 0) {
    blocks.push({ kind: "text", text: "No tickers listed with KPI coverage." });
  } else {
    blocks.push({
      kind: "table",
      head: ["TICKER", "COMPANY", "SERIES", "UPDATED", "SAMPLE"],
      align: ["left", "left", "right", "left", "left"],
      rows: shown.map((row) => [
        cell(row.ticker),
        cell(truncate(row.companyName ?? "", full ? 48 : 32)),
        cell(String(row.kpiCount)),
        cell((row.lastUpdated ?? "").slice(0, 10)),
        cell(row.sampleCompany ? "sample" : "", row.sampleCompany ? "accent" : undefined),
      ]),
    });
  }
  if (samples.length > 0) {
    blocks.push({
      kind: "text",
      text: `Full KPI data on ${samples.length} sample companies, free; a preview for every other company. PRO unlocks them all.`,
      tone: "dim",
    });
  }
  if (shown.length < rows.length) {
    blocks.push({
      kind: "text",
      text:
        samples.length > 0 && !full
          ? `Showing the ${shown.length} sample companies of ${rows.length} covered tickers. Add --full for all of them.`
          : `Showing ${shown.length} of ${rows.length} covered tickers. Add --full for all of them.`,
      tone: "dim",
    });
  }
  return { json: response, doc: doc(...blocks) };
}
