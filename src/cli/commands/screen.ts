import type { ScreenerFilter, ScreenerPlan, ScreenerSort } from "../../types.js";
import type { CommandDef } from "../command.js";
import { CliUsageError } from "../errors.js";
import { flagList } from "../parse.js";
import { cell, doc, field, fields, type Block } from "../render/doc.js";
import { direction, fixed, humanize, percent, signed, truncate } from "../render/num.js";
import { rejectPositionals } from "../ticker.js";

const OPS = ["GTE", "LTE", "GT", "LT", "EQ", "NEQ", "IN", "NOT_IN"] as const;
type Op = (typeof OPS)[number];

function parseFilter(raw: string): ScreenerFilter {
  const parts = raw.split(":");
  if (parts.length < 3) {
    throw new CliUsageError(
      `--filter takes FIELD:OP:VALUE, got "${raw}".`,
      "for example: --filter SENTI_SCORE_7D:GTE:13",
    );
  }
  const fieldName = parts[0].toUpperCase();
  const op = parts[1].toUpperCase() as Op;
  const value = parts.slice(2).join(":");
  if (!OPS.includes(op)) {
    throw new CliUsageError(
      `unknown filter operator "${parts[1]}".`,
      `operators are ${OPS.join(", ")}.`,
    );
  }
  if (op === "IN" || op === "NOT_IN") {
    return { fieldName, op, values: value.split(",").map((v) => v.trim()).filter(Boolean) };
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new CliUsageError(
      `--filter ${fieldName}:${op} expects a number, got "${value}".`,
      "for example: --filter SENTI_SCORE_7D:GTE:13",
    );
  }
  return { fieldName, op, value: numeric };
}

function parseSort(raw: string): ScreenerSort {
  const [name, dirRaw] = raw.split(":");
  const dir = (dirRaw ?? "DESC").toUpperCase();
  if (dir !== "ASC" && dir !== "DESC") {
    throw new CliUsageError(
      `--sort direction takes ASC or DESC, got "${dirRaw}".`,
      "for example: --sort SENTI_SCORE_7D:DESC",
    );
  }
  return { fieldName: name.toUpperCase(), dir };
}

export const screenCommand: CommandDef = {
  name: "screen",
  summary: "Filter the tracked universe on Score, analyst, technical, and price fields",
  usage: "sentisense screen [--filter FIELD:OP:VALUE]... [--sort FIELD:DIR] [--limit N]",
  examples: [
    "sentisense screen --list",
    "sentisense screen --fields",
    "sentisense screen --filter SENTI_SCORE_7D:GTE:13 --filter ANALYST_COUNT:GTE:5",
    "sentisense screen --filter SENTI_SCORE_7D:GTE:13 --sort SENTI_SCORE_7D:DESC --limit 25",
    "sentisense screen --etf --filter ISSUER:IN:Vanguard,iShares",
  ],
  notes: [
    "Filters are ANDed. Operators: GTE, LTE, GT, LT, EQ, NEQ, IN, NOT_IN.",
    "Start from --fields for the real field names and their operators, or --list for the",
    "curated screens, which are also worked examples of the plan shape.",
    "Two field semantics catch people out: ANALYST_RATING_MEAN runs 1 to 5 with 1 as strong",
    "buy, so bullish is LTE 2.5, and the Score fields are banded at 5, 13, and 23 either side",
    "of zero, so filtering on 0.5 means any positive score.",
    "Nulls never match in either direction, so two opposite filters do not partition the",
    "universe: a stock with no data for that field is in neither result.",
    "Rows read a snapshot that refreshes every 20 minutes, so prices here are not live.",
  ],
  flags: {
    filter: {
      type: "string",
      placeholder: "FIELD:OP:VALUE",
      repeat: true,
      describe: "Filter leg, may be repeated",
    },
    sort: { type: "string", placeholder: "FIELD:DIR", describe: "Sort field and direction" },
    limit: { type: "number", placeholder: "N", describe: "Rows to return, caps at 500" },
    tickers: { type: "string", placeholder: "A,B,C", describe: "Screen only these symbols" },
    screen: { type: "string", placeholder: "id", describe: "Run a curated screen by id" },
    list: { type: "boolean", describe: "List the curated screens and exit" },
    fields: { type: "boolean", describe: "List the filterable fields and exit" },
    etf: { type: "boolean", describe: "Screen the ETF universe" },
  },
  async run({ args, client, full }) {
    // A screen is described entirely by flags, so a bare symbol means someone wanted
    // --tickers and would otherwise have it silently dropped.
    rejectPositionals(args, "screen");
    const api = client();
    const etf = args.flags.etf === true;

    if (args.flags.fields === true) {
      const catalog = await api.screener.fields();
      const list = etf ? catalog.etf : catalog.stock;
      return {
        json: catalog,
        doc: doc(
          {
            kind: "head",
            title: field("universe", etf ? "ETF fields" : "Stock fields"),
            right: fields(field("count", String(list.length))),
          },
          {
            kind: "table",
            head: ["FIELD", "GROUP", "TYPE", "UNIT", "OPS"],
            rows: list.map((descriptor) => [
              cell(descriptor.name),
              cell(descriptor.group),
              cell(descriptor.type),
              cell(descriptor.unit ?? ""),
              cell(descriptor.ops.join(",")),
            ]),
          },
        ),
      };
    }

    if (args.flags.list === true) {
      const response = await api.screener.screens();
      return {
        json: response,
        doc: doc(
          {
            kind: "head",
            title: field("scope", "Curated screens"),
            right: fields(field("count", String(response.screens.length))),
          },
          {
            kind: "table",
            head: ["ID", "NAME", "SUMMARY"],
            rows: response.screens.map((screen) => [
              cell(screen.id),
              cell(screen.name),
              cell(truncate(screen.summary, full ? 160 : 60)),
            ]),
          },
          { kind: "text", text: 'Run one with "sentisense screen --screen <id>".', tone: "dim" },
        ),
      };
    }

    const limit = typeof args.flags.limit === "number" ? args.flags.limit : undefined;
    const tickers =
      typeof args.flags.tickers === "string"
        ? args.flags.tickers.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean)
        : undefined;

    let plan: ScreenerPlan;
    let planName: string;
    let runEtfUniverse = etf;

    const screenId = typeof args.flags.screen === "string" ? args.flags.screen : undefined;
    if (screenId) {
      const response = await api.screener.screens();
      const found = response.screens.find((screen) => screen.id === screenId);
      if (!found) {
        throw new CliUsageError(
          `no curated screen with id "${screenId}".`,
          'run "sentisense screen --list" for the ids.',
        );
      }
      plan = found.plan;
      planName = found.name;
      runEtfUniverse = etf || found.plan.universe === "ETF";
    } else {
      const legs = flagList(args.flags, "filter").map(parseFilter);
      if (legs.length === 0) {
        throw new CliUsageError(
          "screen needs at least one --filter, or a --screen id.",
          'try "sentisense screen --list", or --filter SENTI_SCORE_7D:GTE:13',
        );
      }
      plan = {
        filters: legs,
        ...(typeof args.flags.sort === "string" ? { sort: parseSort(args.flags.sort) } : {}),
      };
      planName = "custom";
    }

    const request = {
      plan,
      ...(limit === undefined ? {} : { limit }),
      ...(tickers ? { tickers } : {}),
    };

    if (runEtfUniverse) {
      const response = await api.screener.runEtfs(request);
      const rows = response.results ?? [];
      const blocks: Block[] = [
        {
          kind: "head",
          title: field("screen", planName),
          right: fields(
            field("matched", String(response.matched)),
            field("returned", String(rows.length)),
          ),
        },
      ];
      if (rows.length === 0) {
        blocks.push({ kind: "text", text: "No ETFs match this plan." });
      } else {
        blocks.push({
          kind: "table",
          head: ["TICKER", "NAME", "ISSUER", "PRICE", "CHANGE%", "AUM", "EXPENSE", "SCORE"],
          align: ["left", "left", "left", "right", "right", "right", "right", "right"],
          rows: rows.map((row) => [
            cell(row.ticker),
            cell(truncate(row.name ?? "", full ? 40 : 24)),
            cell(truncate(row.issuer ?? "", 14)),
            cell(fixed(row.currentPrice)),
            cell(fixed(row.changePercent), direction(row.changePercent)),
            cell(humanize(row.marketCap)),
            cell(percent(row.expenseRatio, 2)),
            cell(fixed(row.constituentsWeightedSentisense, 1), "accent"),
          ]),
        });
      }
      if (response.matched > rows.length) {
        blocks.push({
          kind: "text",
          text: `Matched ${response.matched}, showing the top ${rows.length} under the plan sort. Raise --limit for more.`,
          tone: "dim",
        });
      }
      return { json: response, doc: doc(...blocks) };
    }

    const response = await api.screener.run(request);
    const rows = response.results ?? [];
    const blocks: Block[] = [
      {
        kind: "head",
        title: field("screen", planName),
        right: fields(
          field("matched", String(response.matched)),
          field("returned", String(rows.length)),
        ),
      },
    ];

    if (rows.length === 0) {
      blocks.push({ kind: "text", text: "No stocks match this plan." });
    } else {
      blocks.push({
        kind: "table",
        head: ["TICKER", "PRICE", "CHANGE%", "SCORE 7D", "VS 1M", "MKT CAP", "BUY%", "ANALYSTS"],
        align: ["left", "right", "right", "right", "right", "right", "right", "right"],
        rows: rows.map((row) => [
          cell(row.ticker),
          cell(fixed(row.currentPrice)),
          cell(fixed(row.changePercent), direction(row.changePercent)),
          cell(fixed(row.sentiSenseScore7D, 1), "accent"),
          cell(signed(row.scoreChange7D, 1), direction(row.scoreChange7D)),
          cell(humanize(row.marketCap)),
          cell(fixed(row.analystBuyRatioPct, 0)),
          cell(row.analystCount === null || row.analystCount === undefined ? "n/a" : String(row.analystCount)),
        ]),
      });
    }

    if (response.matched > rows.length) {
      blocks.push({
        kind: "text",
        text: `Matched ${response.matched}, showing the top ${rows.length} under the plan sort. Raise --limit for more.`,
        tone: "dim",
      });
    }

    return { json: response, doc: doc(...blocks) };
  },
};
