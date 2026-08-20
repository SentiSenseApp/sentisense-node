import type { CommandDef } from "../command.js";
import { cell, doc, field, fields, type Block } from "../render/doc.js";
import { direction, fixed, signed } from "../render/num.js";
import { rejectPositionals } from "../ticker.js";

/**
 * Local narrowing for the mood payload.
 *
 * The SDK types it as an open record because the signal list grows, so the reader states the
 * shape it renders rather than asserting the whole response.
 */
interface MoodSignal {
  key?: string;
  label?: string;
  value?: number | null;
  change?: number | null;
}

interface MoodBand {
  currentScore?: number | null;
  phase?: string | null;
  weeklyChange?: number | null;
}

interface MoodMarket extends MoodBand {
  signals?: MoodSignal[];
  history?: Array<{ date?: string; score?: number | null }>;
}

function readMarket(payload: unknown): MoodMarket {
  if (!payload || typeof payload !== "object") return {};
  const market = (payload as Record<string, unknown>).market;
  return market && typeof market === "object" ? (market as MoodMarket) : {};
}

function readSectors(payload: unknown): Array<[string, MoodBand]> {
  if (!payload || typeof payload !== "object") return [];
  const sectors = (payload as Record<string, unknown>).sectors;
  if (!sectors || typeof sectors !== "object") return [];
  return Object.entries(sectors as Record<string, MoodBand>).sort(
    (a, b) => (b[1]?.currentScore ?? 0) - (a[1]?.currentScore ?? 0),
  );
}

export const moodCommand: CommandDef = {
  name: "mood",
  summary: "Composite market sentiment, its signals, and the sector map",
  usage: "sentisense mood",
  examples: ["sentisense mood", "sentisense mood --full", "sentisense mood --json"],
  notes: [
    "One 0 to 100 score for the whole market, with the six signals behind it and a",
    "per-sector breakdown. Bands: 0-15 extreme fear, 16-30 fear, 31-45 anxiety,",
    "46-55 neutral, 56-70 optimism, 71-85 greed, 86-100 extreme greed.",
  ],
  flags: {},
  async run({ args, client, full }) {
    // Market Mood is one index, not a per-ticker reading, so a symbol here is a
    // misunderstanding worth naming rather than ignoring.
    rejectPositionals(args, "mood");
    const payload = await client().marketMood.get();
    const market = readMarket(payload);
    const sectors = readSectors(payload);
    const history = (market.history ?? [])
      .map((point) => point?.score)
      .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

    const blocks: Block[] = [
      {
        kind: "head",
        title: field("index", "Market Mood"),
        right: fields(
          field("score", fixed(market.currentScore, 1), "accent"),
          market.phase ? field("phase", String(market.phase)) : undefined,
          field(
            "weekly change",
            `${signed(market.weeklyChange, 1)} wk`,
            direction(market.weeklyChange),
          ),
        ),
      },
    ];

    const signals = market.signals ?? [];
    if (signals.length > 0) {
      blocks.push({
        kind: "facts",
        items: signals.map((signal) =>
          field(signal.label ?? signal.key ?? "signal", fixed(signal.value, 1)),
        ),
      });
    }

    if (history.length > 0) {
      const tail = full ? history : history.slice(-60);
      blocks.push({
        kind: "spark",
        label: `${tail.length}d`,
        series: tail,
        note: market.history?.[market.history.length - 1]?.date
          ? `to ${market.history[market.history.length - 1].date}`
          : undefined,
      });
    }

    if (sectors.length > 0) {
      blocks.push({ kind: "blank" });
      blocks.push({
        kind: "table",
        head: ["SECTOR", "SCORE", "PHASE", "WEEK"],
        align: ["left", "right", "left", "right"],
        rows: sectors.map(([name, band]) => [
          cell(name),
          cell(fixed(band?.currentScore, 1)),
          cell(band?.phase ?? "n/a"),
          cell(signed(band?.weeklyChange, 1), direction(band?.weeklyChange)),
        ]),
      });
    }

    if (full && signals.length > 0) {
      blocks.push({ kind: "blank" });
      blocks.push({
        kind: "table",
        head: ["SIGNAL", "VALUE", "CHANGE"],
        align: ["left", "right", "right"],
        rows: signals.map((signal) => [
          cell(signal.label ?? signal.key ?? "signal"),
          cell(fixed(signal.value, 1)),
          cell(signed(signal.change, 1), direction(signal.change)),
        ]),
      });
    }

    return { json: payload, doc: doc(...blocks) };
  },
};
