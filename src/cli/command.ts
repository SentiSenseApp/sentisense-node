import type { SentiSense } from "../client.js";
import type { ResolvedContext } from "./context.js";
import type { Doc } from "./render/doc.js";
import type { FlagSpecs, ParsedArgs } from "./parse.js";

export interface CommandIO {
  env: Record<string, string | undefined>;
  isTTY?: boolean;
  configDir?: string;
}

export interface CommandInput {
  args: ParsedArgs;
  context: ResolvedContext;
  io: CommandIO;
  /**
   * Built lazily, so a command that needs no network (and `--help`) never trips the
   * missing-key check.
   */
  client(): SentiSense;
  /** Whether `--full` was passed. Commands widen their output, never their request. */
  full: boolean;
  /**
   * Which renderer will receive the result.
   *
   * Commands read this only to skip work nobody will see: a display name is worth a request
   * when a person is reading the output and is dead weight for a pipe or a parser.
   */
  mode: OutputMode;
}

export type OutputMode = "json" | "pretty" | "plain";

export interface CommandResult {
  /** The API responses exactly as received. What `--json` prints. */
  json: unknown;
  /** What the pretty and plain renderers turn into text. */
  doc: Doc;
  /** Overrides the exit code on a successful run. Used by `health`. */
  exitCode?: number;
  /**
   * Something supplementary did not come back, but the answer did.
   *
   * Printed to stderr as `note: ...` so stdout stays clean for a pipe, and the run still
   * exits 0. Degrading in total silence would hide a real outage behind a missing sparkline.
   */
  notes?: string[];
  /**
   * Part of the answer failed while the rest came back, such as one unknown symbol in a
   * multi-ticker quote. Printed to stderr as given, after the output, and the run exits with
   * `exitCode`, which a command setting this must also set. Stdout still carries what did
   * come back.
   */
  errors?: string[];
}

export interface CommandDef {
  name: string;
  summary: string;
  usage: string;
  /** Copy-pasteable, one per line, shown by `sentisense help <command>`. */
  examples: string[];
  flags: FlagSpecs;
  /** Extra paragraph for `sentisense help <command>`, when behaviour needs a word. */
  notes?: string[];
  /**
   * Replaces the `--json` line in this command's help, for a command whose JSON combines more
   * than one API response. Without it the line says the output is the exact API response.
   */
  jsonShape?: string;
  run(input: CommandInput): Promise<CommandResult>;
}
