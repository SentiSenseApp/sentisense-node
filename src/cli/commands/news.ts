import type { Story } from "../../types.js";
import type { CommandDef } from "../command.js";
import { cell, doc, field, fields, type Block } from "../render/doc.js";
import {
  EMPTY_VERIFY_NOTE,
  EMPTY_VERIFY_NOTE_2,
  optionalTicker,
  verifyTickerOnEmpty,
} from "../ticker.js";
import { dateFromSeconds, fixed, signed, truncate } from "../render/num.js";

const DEFAULT_LIMIT = 10;

export const newsCommand: CommandDef = {
  name: "news",
  summary: "Clustered news stories, market-wide or for one ticker",
  usage: "sentisense news [ticker] [--limit N] [--days N]",
  examples: [
    "sentisense news",
    "sentisense news NVDA",
    "sentisense news --limit 25 --full",
    "sentisense news NVDA --json",
  ],
  notes: [
    "A story is a cluster of articles covering the same event, not a single headline, so",
    "the size column is how many sources picked it up and impact ranks how much it moved.",
    "Tone is the average sentiment across the cluster, between -1 and 1.",
    "--days only applies to the market-wide feed, and counts from when a story STARTED",
    "breaking, not from its latest article. A running story with fresh coverage but an",
    "older start falls out of short windows, so an empty window can be correct. It also",
    "switches ordering to curation score instead of the day-bucketed default.",
    EMPTY_VERIFY_NOTE,
    EMPTY_VERIFY_NOTE_2,
  ],
  flags: {
    limit: { type: "number", placeholder: "N", describe: `Stories to return (default ${DEFAULT_LIMIT})` },
    days: {
      type: "number",
      placeholder: "N",
      describe: "Look-back window in days, market-wide feed only",
    },
  },
  async run({ args, client, full }) {
    const api = client();
    const ticker = optionalTicker(args, "news");
    const notes: string[] = [];
    const limit = typeof args.flags.limit === "number" ? args.flags.limit : DEFAULT_LIMIT;
    const days = typeof args.flags.days === "number" ? args.flags.days : undefined;

    // The market-wide feed takes its look-back in hours, so a day count is converted here
    // rather than passed through. The ticker feed has no look-back window at all.
    const stories: Story[] = ticker
      ? await api.documents.getStoriesByTicker(ticker, { limit })
      : await api.documents.getStories({
          limit,
          ...(days === undefined ? {} : { filterHours: days * 24 }),
        });

    if (ticker && stories.length === 0) {
      const note = await verifyTickerOnEmpty(api, ticker);
      if (note) notes.push(note);
    }

    const blocks: Block[] = [
      {
        kind: "head",
        title: field("scope", ticker ?? "Top stories"),
        right: fields(field("stories", String(stories.length))),
      },
    ];

    if (stories.length === 0) {
      blocks.push({ kind: "text", text: "No stories in this window." });
    } else if (full) {
      for (const story of stories) {
        blocks.push({ kind: "blank" });
        blocks.push({
          kind: "head",
          title: field("story", truncate(story.cluster.title, 70)),
          right: fields(
            field("impact", fixed(story.impactScore, 1), "accent"),
            field(
              "tone",
              signed(story.cluster.averageSentiment, 2),
              story.cluster.averageSentiment > 0
                ? "up"
                : story.cluster.averageSentiment < 0
                  ? "down"
                  : undefined,
            ),
          ),
        });
        blocks.push({
          kind: "kv",
          items: fields(
            field("id", story.cluster.id),
            field("sources", String(story.cluster.clusterSize)),
            field("broke", dateFromSeconds(story.brokeAt)),
            field("tickers", story.tickers.join(", ") || "none"),
          ),
        });
      }
    } else {
      blocks.push({
        kind: "table",
        head: ["BROKE", "IMPACT", "TONE", "SRC", "TICKERS", "STORY"],
        align: ["left", "right", "right", "right", "left", "left"],
        rows: stories.map((story) => [
          cell(dateFromSeconds(story.brokeAt)),
          cell(fixed(story.impactScore, 1)),
          cell(
            signed(story.cluster.averageSentiment, 2),
            story.cluster.averageSentiment > 0
              ? "up"
              : story.cluster.averageSentiment < 0
                ? "down"
                : undefined,
          ),
          cell(String(story.cluster.clusterSize)),
          cell(truncate(story.tickers.join(","), 14)),
          cell(truncate(story.cluster.title, 44)),
        ]),
      });
      blocks.push({
        kind: "text",
        text: "Add --full for story ids, source counts, and the full ticker list.",
        tone: "dim",
      });
    }

    return { json: stories, doc: doc(...blocks), notes };
  },
};
