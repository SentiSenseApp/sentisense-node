import type { SentiSense } from "../../client.js";
import type { AnalystCoverageFirm } from "../../resources/analyst.js";
import type { CommandDef, CommandResult } from "../command.js";
import type { ParsedArgs } from "../parse.js";
import { oneTicker } from "../ticker.js";
import { cell, doc, field, fields, type Block, type Cell, type Tone } from "../render/doc.js";
import { direction, fixed, money, signedPercent, truncate } from "../render/num.js";

const DEFAULT_ACTIONS = 5;
const DEFAULT_COVERAGE_ROWS = 15;

function actionTone(actionType: string | undefined | null): Tone | undefined {
  if (actionType === "UPGRADE") return "up";
  if (actionType === "DOWNGRADE") return "down";
  return undefined;
}

/**
 * The individual to print on a firm row.
 *
 * Rating actions are published at firm level, and a large share of price target notes name
 * nobody, so a firm can legitimately have no person attached. Prefer whoever signed the
 * firm's latest note, since that is the row's other columns, and fall back to the desk's
 * first named analyst. The count suffix says the desk has more without spending a row each.
 */
function primaryAnalyst(row: AnalystCoverageFirm): { name: string; slug: string } {
  const named = row.latestNote?.analyst;
  const match =
    (named ? row.analysts.find((analyst) => analyst.name === named) : undefined) ??
    row.analysts[0];
  const name = match?.name ?? named ?? "";
  const extra = row.analysts.length > 1 ? ` +${row.analysts.length - 1}` : "";
  return { name: name ? `${name}${extra}` : "", slug: match?.slug ?? "" };
}

export const analystsCommand: CommandDef = {
  name: "analysts",
  summary: "Wall Street consensus, price target band, and recent rating changes",
  usage: "sentisense analysts <ticker> [--coverage] [--days N] [--limit N]",
  examples: [
    "sentisense analysts NVDA",
    "sentisense analysts NVDA --days 180 --full",
    "sentisense analysts NVDA --coverage",
    "sentisense analysts NVDA --coverage --days 180 --limit 30",
    "sentisense analysts NVDA --json",
  ],
  notes: [
    "The price target band and analyst count come back in full on every key.",
    "The buy / hold / sell distribution and the longer action history are PRO.",
    "A ticker with no analyst coverage exits 4 rather than returning an empty band.",
    "--coverage answers who covers the ticker instead: one row per firm, the analyst that",
    "firm last published under, their latest target, and the firm's current rating. The slug",
    "on a row is what \"sentisense analyst <slug>\" takes.",
    "A firm can cover a ticker on a rating action alone, so a blank target is a real reading",
    "rather than missing data, and a blank analyst means the note named nobody.",
    "--limit trims the rows printed under --coverage; the API returns the whole book either",
    "way, and --full prints all of it.",
  ],
  flags: {
    coverage: { type: "boolean", describe: "Show who covers the ticker, one row per firm" },
    days: { type: "number", placeholder: "N", describe: "Days of rating history (default 90)" },
    limit: { type: "number", placeholder: "N", describe: `Firm rows to print with --coverage (default ${DEFAULT_COVERAGE_ROWS})` },
  },
  async run({ args, client, full }) {
    const ticker = oneTicker(args, "analysts");
    const lookbackDays = typeof args.flags.days === "number" ? args.flags.days : undefined;

    const api = client();

    if (args.flags.coverage === true) {
      return coverageRun({ api, ticker, lookbackDays, full, args });
    }

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

interface CoverageInput {
  api: SentiSense;
  ticker: string;
  lookbackDays: number | undefined;
  full: boolean;
  args: ParsedArgs;
}

/**
 * `--coverage`: who covers the ticker, one row per firm.
 *
 * The response-level counts survive the free truncation, so the header and the rating
 * buckets describe the whole window even when only five rows come back. That is why the
 * shown-of-total line reads off `firmCount` rather than the length of the rows printed.
 */
async function coverageRun({ api, ticker, lookbackDays, full, args }: CoverageInput): Promise<CommandResult> {
  const envelope = await api.analyst.coverage(
    ticker,
    lookbackDays === undefined ? undefined : { lookbackDays },
  );
  const data = envelope.data;
  const rows = data?.coverage ?? [];
  const limit = typeof args.flags.limit === "number" ? args.flags.limit : DEFAULT_COVERAGE_ROWS;
  const shown = full ? rows : rows.slice(0, Math.max(1, limit));

  const blocks: Block[] = [
    {
      kind: "head",
      title: field("ticker", ticker),
      right: fields(
        field("firms", String(data?.firmCount ?? rows.length)),
        field("named analysts", String(data?.namedAnalystCount ?? 0)),
        data?.windowDays === undefined ? undefined : field("window", `${data.windowDays}d`),
      ),
    },
  ];

  const buckets = data?.ratingBuckets;
  if (buckets) {
    blocks.push({
      kind: "facts",
      items: fields(
        field("Buy", String(buckets.buy), buckets.buy > 0 ? "up" : undefined),
        field("Hold", String(buckets.hold)),
        field("Sell", String(buckets.sell), buckets.sell > 0 ? "down" : undefined),
        field("Unrated", String(buckets.unrated)),
        field("Total", String(buckets.total)),
      ),
    });
  }

  blocks.push({
    kind: "facts",
    items: fields(
      field("Notes", String(data?.noteCount ?? 0)),
      field("Attributed", String(data?.attributedNoteCount ?? 0)),
      field("Unattributed", String(data?.unattributedNoteCount ?? 0)),
      field("Rating only", String(data?.ratingOnlyFirmCount ?? 0)),
      data?.asOf === undefined ? undefined : field("As of", data.asOf),
    ),
  });

  if (shown.length === 0) {
    blocks.push({ kind: "text", text: "No firm published a target or a rating in this window." });
  } else {
    blocks.push({ kind: "blank" });
    blocks.push({
      kind: "table",
      head: ["FIRM", "ANALYST", "SLUG", "TARGET", "DATE", "RATING", "ACTION"],
      align: ["left", "left", "left", "right", "left", "left", "left"],
      rows: shown.map((row): Cell[] => {
        const analyst = primaryAnalyst(row);
        return [
          cell(truncate(row.firm, full ? 40 : 24)),
          cell(truncate(analyst.name, full ? 32 : 20)),
          cell(truncate(analyst.slug, full ? 32 : 20)),
          cell(row.latestNote?.priceTarget === null || row.latestNote?.priceTarget === undefined
            ? ""
            : money(row.latestNote.priceTarget)),
          cell(row.latestNote?.publishedDate ?? row.firmRating?.date ?? ""),
          cell(row.firmRating?.rating ?? ""),
          cell(row.firmRating?.actionType ?? "", actionTone(row.firmRating?.actionType)),
        ];
      }),
    });
    const total = data?.firmCount ?? rows.length;
    if (shown.length < total) {
      blocks.push({
        kind: "text",
        text: `Showing ${shown.length} of ${total} firms. Add --full for the rest.`,
        tone: "dim",
      });
    }
  }

  if (data?.attributionNote) {
    blocks.push({ kind: "text", text: data.attributionNote, tone: "dim" });
  }

  if (envelope.isPreview) {
    blocks.push({
      kind: "text",
      text: "Preview response: the counts describe the whole window, the rows are trimmed on a free key.",
      tone: "dim",
    });
  }

  return { json: envelope, doc: doc(...blocks) };
}
