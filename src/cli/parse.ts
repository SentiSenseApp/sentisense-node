import { CliUsageError } from "./errors.js";

export type FlagType = "string" | "number" | "boolean";

export interface FlagSpec {
  type: FlagType;
  describe: string;
  /** Shown in help as `--name <placeholder>`. */
  placeholder?: string;
  /** May be given more than once; values collect into an array. */
  repeat?: boolean;
}

export type FlagSpecs = Record<string, FlagSpec>;
export type FlagValue = string | number | boolean | string[];
export type Flags = Record<string, FlagValue>;

export interface ParsedArgs {
  positionals: string[];
  flags: Flags;
}

/** Flags every command accepts. */
export const GLOBAL_FLAGS: FlagSpecs = {
  json: { type: "boolean", describe: "Print the exact API response as JSON" },
  plain: { type: "boolean", describe: "Force plain text with no colour" },
  pretty: { type: "boolean", describe: "Force the terminal layout" },
  "no-color": { type: "boolean", describe: "Drop colour from the terminal layout" },
  full: { type: "boolean", describe: "Show more rows and more detail" },
  debug: { type: "boolean", describe: "Print stack traces on failure" },
  help: { type: "boolean", describe: "Show help for this command" },
  version: { type: "boolean", describe: "Print the version" },
  "api-key": { type: "string", placeholder: "key", describe: "API key for this call only" },
  "base-url": { type: "string", placeholder: "url", describe: "Override the API base URL" },
  agent: {
    type: "string",
    placeholder: "name",
    describe: "Label this call in the User-Agent",
  },
};

const SHORT_FLAGS: Record<string, string> = {
  "-h": "--help",
  "-v": "--version",
};

/** Levenshtein distance, used only to say "did you mean". */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_, i) => i);
  for (let i = 1; i < rows; i++) {
    const current = [i];
    for (let j = 1; j < cols; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[cols - 1];
}

/** Closest candidate within a small edit budget, or undefined when nothing is close. */
export function nearest(word: string, candidates: string[]): string | undefined {
  let best: string | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const score = editDistance(word.toLowerCase(), candidate.toLowerCase());
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  const budget = Math.max(2, Math.floor(word.length / 3));
  return best !== undefined && bestScore <= budget ? best : undefined;
}

/**
 * The command is the first argument, full stop.
 *
 * Scanning for "the first token that is not a flag" looks friendlier and is not: with
 * `--api-key KEY quote NVDA` it happily reads the key as the command. Anchoring on position
 * means a mistake is always a clear error instead of a confusing one.
 */
export function splitCommand(argv: string[]): { command?: string; rest: string[] } {
  const first = argv[0];
  if (first === undefined) return { rest: [] };
  if (first.startsWith("-")) return { rest: argv };
  return { command: first, rest: argv.slice(1) };
}

export function parseArgs(argv: string[], specs: FlagSpecs): ParsedArgs {
  const positionals: string[] = [];
  const flags: Flags = {};
  const names = Object.keys(specs);

  for (let i = 0; i < argv.length; i++) {
    let token = argv[i];

    if (token === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }

    if (SHORT_FLAGS[token]) token = SHORT_FLAGS[token];

    if (!token.startsWith("--")) {
      if (token.startsWith("-") && token.length > 1 && !/^-\d/.test(token)) {
        throw new CliUsageError(
          `unknown flag "${token}".`,
          'run "sentisense --help" for the flag list.',
        );
      }
      positionals.push(token);
      continue;
    }

    const equals = token.indexOf("=");
    const name = equals === -1 ? token.slice(2) : token.slice(2, equals);
    const inline = equals === -1 ? undefined : token.slice(equals + 1);
    const spec = specs[name];

    if (!spec) {
      const suggestion = nearest(name, names);
      throw new CliUsageError(
        `unknown flag "--${name}".`,
        suggestion
          ? `did you mean "--${suggestion}"?`
          : 'run "sentisense help <command>" for the flags it accepts.',
      );
    }

    if (spec.type === "boolean") {
      if (inline !== undefined && inline !== "true" && inline !== "false") {
        throw new CliUsageError(
          `--${name} is a switch and takes no value.`,
          `drop the "=${inline}".`,
        );
      }
      flags[name] = inline !== "false";
      continue;
    }

    const raw = inline ?? argv[++i];
    if (raw === undefined || (inline === undefined && raw.startsWith("--"))) {
      throw new CliUsageError(
        `--${name} needs a value.`,
        `for example: --${name} ${spec.placeholder ?? "value"}`,
      );
    }

    if (spec.type === "number") {
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        throw new CliUsageError(
          `--${name} expects a number, got "${raw}".`,
          `for example: --${name} 30`,
        );
      }
      flags[name] = value;
      continue;
    }

    if (spec.repeat) {
      const existing = Array.isArray(flags[name]) ? (flags[name] as string[]) : [];
      flags[name] = [...existing, raw];
    } else {
      flags[name] = raw;
    }
  }

  return { positionals, flags };
}

export function flagString(flags: Flags, name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

export function flagNumber(flags: Flags, name: string): number | undefined {
  const value = flags[name];
  return typeof value === "number" ? value : undefined;
}

export function flagBool(flags: Flags, name: string): boolean {
  return flags[name] === true;
}

export function flagList(flags: Flags, name: string): string[] {
  const value = flags[name];
  if (Array.isArray(value)) return value;
  return typeof value === "string" ? [value] : [];
}
