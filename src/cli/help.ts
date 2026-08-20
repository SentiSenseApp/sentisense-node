import { VERSION } from "../version.js";
import type { CommandDef } from "./command.js";
import { COMMANDS } from "./commands/index.js";
import { EXIT_TABLE, KEY_URL } from "./errors.js";
import { GLOBAL_FLAGS, type FlagSpecs } from "./parse.js";

/**
 * Help is written knowing a model reads it more often than a person does.
 *
 * That means exact flag names, real copy-pasteable examples with real tickers, and the exit
 * codes stated rather than implied. No prose padding, no decoration.
 */

/** One representative invocation per command, shown in the command map. */
const EXAMPLE: Record<string, string> = {
  auth: "sentisense auth $SENTISENSE_API_KEY",
  health: "sentisense health",
  quote: "sentisense quote NVDA AAPL",
  sentiment: "sentisense sentiment NVDA --days 30",
  mood: "sentisense mood",
  analysts: "sentisense analysts NVDA",
  earnings: "sentisense earnings --week next",
  insiders: "sentisense insiders NVDA",
  insights: "sentisense insights NVDA",
  congress: "sentisense congress NVDA",
  news: "sentisense news NVDA",
  flows: "sentisense flows NVDA",
  options: "sentisense options NVDA",
  screen: "sentisense screen --filter SENTI_SCORE_7D:GTE:13",
};

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function flagLines(specs: FlagSpecs): string[] {
  const entries = Object.entries(specs);
  if (entries.length === 0) return [];
  const rendered = entries.map(([name, spec]) => ({
    left: spec.type === "boolean" ? `--${name}` : `--${name} <${spec.placeholder ?? "value"}>`,
    describe: spec.describe,
  }));
  const width = Math.max(...rendered.map((entry) => entry.left.length));
  return rendered.map((entry) => `  ${pad(entry.left, width)}  ${entry.describe}`);
}

export function mainHelp(): string {
  const width = Math.max(...COMMANDS.map((command) => command.name.length));
  const lines = [
    `sentisense ${VERSION}`,
    "Market data, sentiment, and filings from the command line.",
    "",
    "Usage: sentisense <command> [arguments] [flags]",
    "",
    "Commands:",
    ...COMMANDS.map(
      (command) => `  ${pad(command.name, width)}  ${command.summary}\n  ${" ".repeat(width)}  ${EXAMPLE[command.name] ?? ""}`,
    ),
    "",
    "Output:",
    "  Pretty in a terminal, plain text when piped, exact API JSON with --json.",
    "  --full widens a command, --plain and --no-color force text, --debug shows stack traces.",
    "",
    "Setup:",
    `  sentisense auth <key>     store a key at ~/.config/sentisense/config.json (0600)`,
    "  SENTISENSE_API_KEY=<key>  or pass it in the environment",
    `  Get a key at ${KEY_URL}`,
    "",
    'Run "sentisense help <command>" for flags, examples, and exit codes.',
    "",
    "Saying who is calling (optional):",
    "  SENTISENSE_AGENT_NAME=<name>   what your agent calls itself",
    "  SENTISENSE_SKILL=<slug>        the skill driving it",
    "  Set either and requests carry that identity, so usage can be understood and the",
    "  tools improved. Nothing needs them, and nothing is inferred when they are absent.",
    "",
    "Research data, not investment advice.",
  ];
  return `${lines.join("\n")}\n`;
}

export function commandHelp(command: CommandDef): string {
  const lines = [
    `sentisense ${command.name}  ${command.summary}`,
    "",
    `Usage: ${command.usage}`,
  ];

  if (command.notes && command.notes.length > 0) {
    lines.push("", ...command.notes);
  }

  const own = flagLines(command.flags);
  if (own.length > 0) lines.push("", "Flags:", ...own);

  lines.push("", "Common flags:", ...flagLines(GLOBAL_FLAGS));
  lines.push("", "Examples:", ...command.examples.map((example) => `  ${example}`));
  lines.push(
    "",
    "Exit codes:",
    ...EXIT_TABLE.map(([code, meaning]) => `  ${code}  ${meaning}`),
  );
  return `${lines.join("\n")}\n`;
}

export function versionLine(): string {
  return `${VERSION}\n`;
}
