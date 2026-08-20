import type { PreviewResponse, ServingMetric, StockSentiment } from "../../types.js";
import type { CommandDef } from "../command.js";
import { CliUsageError } from "../errors.js";
import { cell, doc, field, fields, type Block, type Tone } from "../render/doc.js";
import { fixed, humanize, percent, signed } from "../render/num.js";

const DEFAULT_DAYS = 30;

function toneForDirection(value: string | undefined): Tone | undefined {
  if (value === "Bullish") return "up";
  if (value === "Bearish") return "down";
  return undefined;
}

function seriesValues(metrics: ServingMetric[] | null, fallback: number[] | undefined): number[] {
  if (metrics && metrics.length > 0) {
    const points = metrics
      .map((point) => point.value)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (points.length > 0) return points;
  }
  return fallback ?? [];
}

export const sentimentCommand: CommandDef = {
  name: "sentiment",
  summary: "SentiSense Score, tone, attention, and where the conversation is",
  usage: "sentisense sentiment <ticker> [--days N]",
  examples: [
    "sentisense sentiment NVDA",
    "sentisense sentiment NVDA --days 90",
    "sentisense sentiment NVDA --json",
    "sentisense sentiment NVDA --full",
  ],
  notes: [
    "The SentiSense Score is a composite of tone and attention centred on zero, not a",
    "polarity: it is unbounded, and the bands sit at 5, 13, and 23 either side of zero.",
    "Tone per source is the separate polarity reading, always between -1 and 1, and it is",
    "reported per source rather than blended into one number.",
    "--days sets the Score history window used for the sparkline. Default is 30.",
  ],
  flags: {
    days: { type: "number", placeholder: "N", describe: `Days of Score history (default ${DEFAULT_DAYS})` },
  },
  async run({ args, client, full }) {
    const ticker = args.positionals[0]?.toUpperCase();
    if (!ticker) {
      throw new CliUsageError(
        "sentiment needs a ticker.",
        "for example: sentisense sentiment NVDA",
      );
    }
    const days = typeof args.flags.days === "number" ? args.flags.days : DEFAULT_DAYS;
    if (days < 1) {
      throw new CliUsageError("--days must be at least 1.", "for example: --days 30");
    }

    const api = client();
    const endTime = Date.now();
    const startTime = endTime - days * 24 * 60 * 60 * 1000;

    const notes: string[] = [];
    const [envelope, metrics] = await Promise.all([
      api.stocks.getSentiment(ticker) as Promise<PreviewResponse<StockSentiment>>,
      // Supplementary: the headline reading already carries its own sparkline, so a gap in
      // the time series degrades the display rather than failing the command. It says so on
      // stderr, because a silent gap looks the same as a quiet week.
      api.entityMetrics
        .getMetrics(ticker, {
          metricType: "sentisense_score",
          startTime,
          endTime,
          maxDataPoints: days,
        })
        .catch(() => {
          notes.push("score history unavailable, showing the reading without it");
          return null;
        }),
    ]);

    const data = envelope.data ?? ({} as StockSentiment);
    const series = seriesValues(metrics, data.scoreSparkline);

    // The headline is the 30-day average, because that is what `scoreLabel` and `direction`
    // describe. Today's reading is a separate line and is often absent, so pairing it with
    // the 30-day band would put two different figures under one label.
    const blocks: Block[] = [
      {
        kind: "head",
        title: field("ticker", ticker),
        subtitle: data.companyName ? field("name", data.companyName) : undefined,
        right: fields(
          field("score 30d", fixed(data.sentisenseScoreAvg30d, 1), "accent"),
          data.scoreLabel ? field("band", data.scoreLabel) : undefined,
          data.direction
            ? field("direction", data.direction, toneForDirection(data.direction))
            : undefined,
        ),
      },
      {
        kind: "facts",
        items: fields(
          field("Latest", fixed(data.sentisenseScore, 1)),
          field(
            "30d change",
            signed(data.sentisenseScoreDelta30d, 1),
            typeof data.sentisenseScoreDelta30d === "number"
              ? data.sentisenseScoreDelta30d > 0
                ? "up"
                : data.sentisenseScoreDelta30d < 0
                  ? "down"
                  : undefined
              : undefined,
          ),
          data.trend ? field("Trend", data.trend) : undefined,
        ),
      },
      {
        kind: "facts",
        items: fields(
          field("Mentions", humanize(data.mentions, 1)),
          field("30d avg", humanize(data.mentionsAvg30d, 1)),
          field(
            "Dominance",
            typeof data.socialDominance === "number"
              ? percent(data.socialDominance * 100, 2)
              : "n/a",
          ),
        ),
      },
    ];

    if (series.length > 0) {
      blocks.push({
        kind: "spark",
        label: `${days}d`,
        series,
        note: data.asOf ? `as of ${data.asOf}` : undefined,
      });
    }

    if (data.bySource && data.bySource.length > 0) {
      blocks.push({ kind: "blank" });
      blocks.push({
        kind: "table",
        head: ["SOURCE", "TONE", "SHARE", "VALUE"],
        align: ["left", "left", "right", "right"],
        rows: data.bySource.map((source) => [
          cell(source.source),
          cell(source.direction, toneForDirection(source.direction)),
          cell(percent(source.mentionShare, 0)),
          cell(signed(source.value, 2)),
        ]),
      });
      blocks.push({
        kind: "text",
        text: "Shares are rounded per source, so they sum to about 100 rather than exactly 100.",
        tone: "dim",
      });
    }

    if (full && data.drivers && data.drivers.length > 0) {
      blocks.push({ kind: "blank" });
      blocks.push({
        kind: "table",
        head: ["TONE", "DRIVER"],
        align: ["right", "left"],
        rows: data.drivers.map((driver) => [
          cell(signed(driver.tone, 2), driver.tone > 0 ? "up" : driver.tone < 0 ? "down" : undefined),
          cell(driver.title),
        ]),
      });
    }

    if (full && data.narrative) {
      blocks.push({ kind: "blank" });
      blocks.push({ kind: "text", text: data.narrative });
    }

    if (envelope.isPreview) {
      blocks.push({
        kind: "text",
        text: "Preview response: a PRO key returns the full reading.",
        tone: "dim",
      });
    }

    return {
      json: { sentiment: envelope, series: metrics },
      doc: doc(...blocks),
      notes,
    };
  },
};

