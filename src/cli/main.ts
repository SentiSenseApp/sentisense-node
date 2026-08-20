import { runCli } from "./run.js";

/**
 * The only place in the CLI that touches the process.
 *
 * Streams, environment, and the terminal check are read here and handed to `runCli` as plain
 * values, which is what lets the whole program be exercised in a unit test without spawning
 * anything.
 */
async function main(): Promise<void> {
  process.exitCode = await runCli(process.argv.slice(2), {
    stdout: (chunk) => process.stdout.write(chunk),
    stderr: (chunk) => process.stderr.write(chunk),
    env: process.env,
    isTTY: Boolean(process.stdout.isTTY),
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message}\n`);
  process.stderr.write("next: run the same command with --debug for the stack trace.\n");
  process.exitCode = 1;
});
