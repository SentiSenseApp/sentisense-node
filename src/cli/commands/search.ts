import type { EntitySearchResult } from "../../resources/kb.js";
import type { CommandDef } from "../command.js";
import { CliUsageError, NoMatchError } from "../errors.js";
import { cell, doc, field, fields, type Block } from "../render/doc.js";
import { truncate } from "../render/num.js";

const TYPES = ["person", "company", "product", "organization", "etf", "topic", "country"];

/**
 * Everything after the command is the query.
 *
 * A name with a space in it is the normal case here, and quoting it is the kind of thing
 * that only bites once you are already in a script, so both `search Elon Musk` and
 * `search "Elon Musk"` mean the same thing.
 */
function query(positionals: string[]): string {
  const text = positionals.join(" ").trim();
  if (!text) {
    throw new CliUsageError("search needs something to look for.", "for example: sentisense search Tesla");
  }
  if (text.length < 2) {
    throw new CliUsageError(
      `search needs at least 2 characters, and got "${text}".`,
      "for example: sentisense search Tesla",
    );
  }
  return text;
}

export const searchCommand: CommandDef = {
  name: "search",
  summary: "Resolve a name, alias, ticker or slug to the entities we track",
  usage: "sentisense search <name> [--type <kind>] [--limit N]",
  examples: [
    "sentisense search Tesla",
    "sentisense search 'Elon Musk' --type person",
    "sentisense search nvidia --limit 5",
    "sentisense search Tesla --json",
  ],
  notes: [
    "For when you have a name and the rest of your pipeline needs a symbol: search Tesla,",
    "get TSLA, then run quote or sentiment on it.",
    "The slug column is the handle the metric endpoints address an entity by, which is the",
    "only place to get it for a person, product or topic that has no ticker.",
    `--type narrows to one kind: ${TYPES.join(", ")}.`,
    "Ranking is the API's, and a company can sort below its own products, so reach for",
    "--type company when what you want is the issuer. A query that matches nothing exits 4.",
  ],
  flags: {
    type: { type: "string", placeholder: "kind", describe: `Narrow to one kind: ${TYPES.join(", ")}` },
    limit: { type: "number", placeholder: "N", describe: "Matches to return, 1 to 25 (default 10)" },
  },
  async run({ args, client, full }) {
    const text = query(args.positionals);
    const type = typeof args.flags.type === "string" ? args.flags.type.toLowerCase() : undefined;
    if (type && !TYPES.includes(type)) {
      throw new CliUsageError(
        `--type takes one of ${TYPES.join(", ")}, got "${type}".`,
        "for example: --type company",
      );
    }
    const limit = typeof args.flags.limit === "number" ? args.flags.limit : undefined;

    const api = client();
    const results: EntitySearchResult[] = await api.kb.searchEntities(text, {
      ...(type ? { type } : {}),
      ...(limit === undefined ? {} : { limit }),
    });

    if (results.length === 0) {
      throw new NoMatchError(
        text,
        type
          ? `nothing of type ${type} matched. Try dropping --type, or fewer characters.`
          : "try fewer characters, another spelling, or the ticker itself.",
      );
    }

    const blocks: Block[] = [
      {
        kind: "head",
        title: field("query", text),
        right: fields(
          field("matches", String(results.length)),
          type === undefined ? undefined : field("type", type),
        ),
      },
      { kind: "blank" },
      {
        kind: "table",
        head: ["SYMBOL", "NAME", "TYPE", "SLUG"],
        rows: results.map((hit) => [
          cell(hit.ticker ?? "", hit.ticker ? "accent" : undefined),
          cell(truncate(hit.name, full ? 60 : 34)),
          cell(hit.type ?? ""),
          cell(truncate(hit.urlSlug ?? "", full ? 60 : 34)),
        ]),
      },
    ];

    return { json: results, doc: doc(...blocks) };
  },
};
