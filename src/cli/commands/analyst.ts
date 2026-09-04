import type { CommandDef } from "../command.js";
import { CliUsageError } from "../errors.js";
import { cell, doc, field, fields, type Block } from "../render/doc.js";
import { money, truncate } from "../render/num.js";

const DEFAULT_CALLS = 25;

/**
 * The one line this command must always print.
 *
 * Everything here is what a person published and when. There is no hit rate, no accuracy
 * score and no ranking behind any of it, and a reader who assumes otherwise has drawn a
 * conclusion the data does not support.
 */
const NOT_A_SCORECARD =
  "Call history, not accuracy scoring: no hit rate, no ranking, and nothing here rates the person.";

/**
 * The slug the API addresses an analyst by.
 *
 * The endpoint resolves slugs only, so a name is a 404 waiting to happen. Catching it here
 * costs nothing and lets the message point at where slugs actually come from, instead of
 * spending a request to say "not found".
 */
function oneSlug(positionals: string[]): string {
  if (positionals.length > 1) {
    throw new CliUsageError(
      `analyst takes one slug, and got ${positionals.length}.`,
      "run it once per analyst.",
    );
  }
  const raw = positionals[0];
  if (!raw) {
    throw new CliUsageError(
      "analyst needs a slug.",
      'for example: sentisense analyst dan-ives. Slugs come from "sentisense analysts <ticker> --coverage".',
    );
  }
  if (/\s/.test(raw)) {
    throw new CliUsageError(
      `analyst takes a slug, not a name, and got "${raw}".`,
      'slugs are lowercase and hyphenated, such as dan-ives. Every named analyst in "sentisense analysts <ticker> --coverage" carries one.',
    );
  }
  return raw.toLowerCase();
}

export const analystCommand: CommandDef = {
  name: "analyst",
  summary: "One analyst: the firms they publish under, what they cover, and their calls",
  usage: "sentisense analyst <slug> [--calls] [--limit N]",
  examples: [
    "sentisense analyst dan-ives",
    "sentisense analyst dan-ives --calls",
    "sentisense analyst dan-ives --calls --limit 50 --full",
    "sentisense analyst dan-ives --json",
  ],
  notes: [
    "Takes a slug, not a name. Slugs are lowercase and hyphenated, and every named analyst",
    'in "sentisense analysts <ticker> --coverage" carries the one that addresses them here.',
    "--calls appends their price target notes, newest first.",
    "firstSeen and lastSeen bound the notes on record, not employment: the most recent firm",
    "is where they last published, not necessarily where they work today.",
    NOT_A_SCORECARD,
    "A slug that matches no analyst exits 4.",
  ],
  flags: {
    calls: { type: "boolean", describe: "Append their price target notes, newest first" },
    limit: { type: "number", placeholder: "N", describe: `Calls to request, 1 to 200 (default ${DEFAULT_CALLS})` },
  },
  async run({ args, client, full }) {
    const slug = oneSlug(args.positionals);
    const wantCalls = args.flags.calls === true;
    const limit = typeof args.flags.limit === "number" ? args.flags.limit : undefined;

    const api = client();
    const profileEnvelope = await api.analyst.profile(slug);
    const callsEnvelope = wantCalls
      ? await api.analyst.calls(slug, limit === undefined ? undefined : { limit })
      : null;

    const data = profileEnvelope.data;
    const blocks: Block[] = [
      {
        kind: "head",
        title: field("analyst", data?.name ?? slug),
        subtitle: field("slug", data?.slug ?? slug),
        right: fields(
          field("notes", String(data?.noteCount ?? 0)),
          field("tickers", String(data?.tickerCount ?? 0)),
        ),
      },
      {
        kind: "facts",
        items: fields(
          field("Most recent firm", data?.mostRecentFirm ?? "n/a"),
          field("First seen", data?.firstSeen ?? "n/a"),
          field("Last seen", data?.lastSeen ?? "n/a"),
        ),
      },
    ];

    const firms = data?.firms ?? [];
    if (firms.length > 0) {
      blocks.push({ kind: "blank" });
      blocks.push({
        kind: "table",
        head: ["FIRM", "FIRST NOTE", "LAST NOTE", "CURRENT"],
        rows: firms.map((firm) => [
          cell(truncate(firm.firm, full ? 40 : 28)),
          cell(firm.firstSeen),
          cell(firm.lastSeen),
          cell(firm.mostRecent ? "yes" : ""),
        ]),
      });
    }

    const book = data?.coverage ?? [];
    if (book.length > 0) {
      const shown = full ? book : book.slice(0, 10);
      blocks.push({ kind: "blank" });
      blocks.push({
        kind: "table",
        head: ["TICKER", "NOTES", "LAST NOTE", "TARGET", "FIRM"],
        align: ["left", "right", "left", "right", "left"],
        rows: shown.map((entry) => [
          cell(entry.ticker),
          cell(String(entry.noteCount)),
          cell(entry.lastNote ?? ""),
          cell(entry.latestPriceTarget === null ? "" : money(entry.latestPriceTarget)),
          cell(truncate(entry.latestFirm ?? "", full ? 40 : 24)),
        ]),
      });
      const total = profileEnvelope.totalCount ?? data?.tickerCount ?? book.length;
      if (shown.length < total) {
        blocks.push({
          kind: "text",
          text: `Showing ${shown.length} of ${total} covered tickers. Add --full for the rest.`,
          tone: "dim",
        });
      }
    }

    if (callsEnvelope) {
      const calls = callsEnvelope.data ?? [];
      blocks.push({ kind: "blank" });
      if (calls.length === 0) {
        blocks.push({ kind: "text", text: "No price target notes on record for this analyst." });
      } else {
        const shown = full ? calls : calls.slice(0, 15);
        blocks.push({
          kind: "table",
          head: ["DATE", "TICKER", "FIRM", "TARGET", "PRICE THEN", "PUBLISHER"],
          align: ["left", "left", "left", "right", "right", "left"],
          rows: shown.map((call) => [
            cell(call.publishedDate),
            cell(call.ticker),
            cell(truncate(call.firm, full ? 40 : 22)),
            cell(call.priceTarget === null ? "" : money(call.priceTarget)),
            cell(call.priceWhenPosted === null ? "" : money(call.priceWhenPosted)),
            cell(truncate(call.newsPublisher ?? "", full ? 40 : 20)),
          ]),
        });
        const total = callsEnvelope.totalCount ?? calls.length;
        if (shown.length < total) {
          blocks.push({
            kind: "text",
            text: `Showing ${shown.length} of ${total} calls. Add --full, or --limit to ask for more.`,
            tone: "dim",
          });
        }
      }
      if (callsEnvelope.isPreview) {
        blocks.push({
          kind: "text",
          text: "Preview response: a free key reads the first 25 calls, a PRO key pages the whole history.",
          tone: "dim",
        });
      }
    }

    if (profileEnvelope.isPreview) {
      blocks.push({
        kind: "text",
        text: "Preview response: the coverage book is trimmed to the 5 most recent tickers on a free key.",
        tone: "dim",
      });
    }

    blocks.push({ kind: "text", text: NOT_A_SCORECARD, tone: "dim" });

    return {
      json: callsEnvelope ? { profile: profileEnvelope, calls: callsEnvelope } : profileEnvelope,
      doc: doc(...blocks),
    };
  },
};
