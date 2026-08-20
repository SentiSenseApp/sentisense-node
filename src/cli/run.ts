import type { SentiSense } from "../client.js";
import type { OutputMode } from "./command.js";
import { COMMAND_NAMES, findCommand, OFFLINE_COMMANDS } from "./commands/index.js";
import { createClient, resolveContext } from "./context.js";
import { CliUsageError, describeError, EXIT } from "./errors.js";
import { commandHelp, mainHelp, versionLine } from "./help.js";
import { GLOBAL_FLAGS, nearest, parseArgs, splitCommand, type Flags } from "./parse.js";
import { createStyler, shouldColor } from "./render/ansi.js";
import { renderJson } from "./render/json.js";
import { renderPlain } from "./render/plain.js";
import { renderPretty } from "./render/pretty.js";

/**
 * Everything the CLI is allowed to touch.
 *
 * Nothing under `cli/` outside `main.ts` reads `process`, so a test drives the whole program
 * by calling `runCli` with its own streams, environment, and config directory. That is also
 * why `runCli` returns the exit code instead of setting one.
 */
export interface CliIO {
  stdout(chunk: string): void;
  stderr(chunk: string): void;
  env: Record<string, string | undefined>;
  /** Overrides where settings are read and written. */
  configDir?: string;
  /** Whether stdout is a terminal. Decides pretty against plain, and colour against none. */
  isTTY?: boolean;
}

function outputMode(flags: Flags, isTTY: boolean | undefined): OutputMode {
  if (flags.json === true) return "json";
  if (flags.plain === true) return "plain";
  if (flags.pretty === true) return "pretty";
  return isTTY === true ? "pretty" : "plain";
}

export async function runCli(argv: string[], io: CliIO): Promise<number> {
  const { command: name, rest } = splitCommand(argv);

  // No command at all: only the two global switches mean anything, and both are informational.
  if (!name) {
    const bare = parseArgs(rest, GLOBAL_FLAGS);
    if (bare.flags.version === true) {
      io.stdout(versionLine());
      return EXIT.OK;
    }
    io.stdout(mainHelp());
    return EXIT.OK;
  }

  try {
    if (name === "help") {
      const target = rest.find((token) => !token.startsWith("-"));
      if (!target) {
        io.stdout(mainHelp());
        return EXIT.OK;
      }
      const command = findCommand(target);
      if (!command) throw unknownCommand(target);
      io.stdout(commandHelp(command));
      return EXIT.OK;
    }

    const command = findCommand(name);
    if (!command) throw unknownCommand(name);

    const specs = { ...GLOBAL_FLAGS, ...command.flags };
    const args = parseArgs(rest, specs);

    if (args.flags.help === true) {
      io.stdout(commandHelp(command));
      return EXIT.OK;
    }
    if (args.flags.version === true) {
      io.stdout(versionLine());
      return EXIT.OK;
    }

    const context = resolveContext({ flags: args.flags, env: io.env, configDir: io.configDir });

    let cached: SentiSense | undefined;
    const client = () => {
      if (!cached) cached = createClient(context);
      return cached;
    };

    // Resolved before the command runs, because a command may skip a request whose only
    // purpose is display.
    const mode = outputMode(args.flags, io.isTTY);

    const result = await command.run({
      args,
      context,
      io: { env: io.env, isTTY: io.isTTY, configDir: io.configDir },
      client: OFFLINE_COMMANDS.has(command.name)
        ? () => {
            throw new Error(`${command.name} does not call the API`);
          }
        : client,
      full: args.flags.full === true,
      mode,
    });

    const color = shouldColor({
      pretty: mode === "pretty",
      noColorFlag: args.flags["no-color"] === true,
      env: io.env,
      isTTY: io.isTTY,
    });

    for (const note of result.notes ?? []) {
      io.stderr(`${createStyler(color).dim(`note: ${note}`)}\n`);
    }

    if (mode === "json") {
      io.stdout(renderJson(result.json));
    } else if (mode === "pretty") {
      io.stdout(renderPretty(result.doc, color));
    } else {
      io.stdout(renderPlain(result.doc));
    }

    return result.exitCode ?? EXIT.OK;
  } catch (error) {
    const debug = argv.includes("--debug");
    const report = describeError(error, debug);
    for (const line of report.lines) io.stderr(`${line}\n`);
    return report.exitCode;
  }
}

function unknownCommand(name: string): CliUsageError {
  const suggestion = nearest(name, COMMAND_NAMES);
  return new CliUsageError(
    `unknown command "${name}".`,
    suggestion
      ? `did you mean "${suggestion}"? Run "sentisense --help" for the full list.`
      : 'run "sentisense --help" for the command list.',
  );
}
