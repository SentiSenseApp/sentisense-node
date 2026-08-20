import { AuthenticationError, SentiSenseError } from "../../errors.js";
import { VERSION } from "../../version.js";
import type { CommandDef } from "../command.js";
import { maskKey } from "../config.js";
import { createClient, effectiveBaseUrl } from "../context.js";
import { EXIT, KEY_URL } from "../errors.js";
import { doc, field } from "../render/doc.js";
import { rejectPositionals } from "../ticker.js";

interface Probe {
  ok: boolean;
  detail: string;
  latencyMs?: number;
}

/**
 * `stocks.getMarketStatus()` is the probe for both questions.
 *
 * It is the smallest documented response the API serves, and every endpoint needs a key, so
 * an anonymous call that comes back 401 has already proved the host is up. The same call
 * with the key then proves the key works, for the price of one more tiny request.
 */
async function probe(run: () => Promise<unknown>): Promise<Probe> {
  const started = Date.now();
  try {
    await run();
    return { ok: true, detail: "ok", latencyMs: Date.now() - started };
  } catch (error) {
    const latencyMs = Date.now() - started;
    if (error instanceof AuthenticationError) {
      return { ok: false, detail: `rejected (${error.status ?? 401})`, latencyMs };
    }
    if (error instanceof SentiSenseError && error.status === undefined) {
      return { ok: false, detail: `unreachable: ${error.message}`, latencyMs };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, detail: message, latencyMs };
  }
}

export const healthCommand: CommandDef = {
  name: "health",
  summary: "Check that the API is reachable and the key works",
  usage: "sentisense health",
  examples: ["sentisense health", "sentisense health --json"],
  notes: [
    "Run this first on a new machine. It answers three questions in one call each:",
    "is the host up, is the key accepted, and how slow is the round trip.",
    "Exits 3 when the key is missing or rejected, 6 when the host cannot be reached.",
  ],
  flags: {},
  async run({ args, context }) {
    rejectPositionals(args, "health");
    const baseUrl = effectiveBaseUrl(context);

    const anonymous = createClient(context, { anonymous: true });
    const reach = await probe(() => anonymous.stocks.getMarketStatus());
    // An anonymous call is expected to be refused; being refused is proof of life.
    const reachable = reach.ok || reach.detail.startsWith("rejected");

    let keyState: Probe;
    if (!context.apiKey) {
      keyState = { ok: false, detail: "not configured" };
    } else if (!reachable) {
      keyState = { ok: false, detail: "not checked" };
    } else {
      const keyed = createClient(context);
      keyState = await probe(() => keyed.stocks.getMarketStatus());
    }

    const exitCode = !reachable ? EXIT.NETWORK : keyState.ok ? EXIT.OK : EXIT.AUTH;
    const latency = keyState.latencyMs ?? reach.latencyMs;

    const nextStep = !reachable
      ? `check the network and the base URL (${baseUrl}).`
      : !context.apiKey
        ? `run "sentisense auth <key>", or set SENTISENSE_API_KEY. Get a key at ${KEY_URL}`
        : keyState.ok
          ? undefined
          : `the stored key was refused. Replace it with "sentisense auth <key>" or get a new one at ${KEY_URL}`;

    return {
      exitCode,
      json: {
        ok: exitCode === EXIT.OK,
        baseUrl,
        reachable,
        apiKey: context.apiKey ? maskKey(context.apiKey) : null,
        apiKeySource: context.apiKeySource,
        apiKeyValid: keyState.ok,
        latencyMs: latency ?? null,
        cliVersion: VERSION,
        sdkVersion: VERSION,
      },
      doc: doc(
        {
          kind: "kv",
          items: [
            field(
              "reachable",
              reachable ? "yes" : reach.detail,
              reachable ? "up" : "down",
            ),
            field(
              "api key",
              keyState.ok
                ? `ok (${context.apiKey ? maskKey(context.apiKey) : ""})`
                : keyState.detail,
              keyState.ok ? "up" : "down",
            ),
            field("latency", latency === undefined ? "n/a" : `${latency} ms`),
            field("base url", baseUrl),
            field("cli", `sentisense-cli/${VERSION}`),
            field("sdk", `sentisense-node/${VERSION}`),
          ],
        },
        nextStep ? { kind: "text", text: `next: ${nextStep}` } : undefined,
      ),
    };
  },
};
