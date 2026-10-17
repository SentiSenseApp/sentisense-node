import { AuthenticationError, NotFoundError, RateLimitError, SentiSenseError } from "../../errors.js";
import type { CommandDef } from "../command.js";
import { maskKey, readOrCreateInstallId } from "../config.js";
import { createClient } from "../context.js";
import { CliCommandError, CliUsageError, EXIT, KEY_URL } from "../errors.js";
import { doc } from "../render/doc.js";

export const ENV_VAR = "SENTISENSE_API_KEY";
/** What a key must look like before it is printed as an env line. Rules out newlines and quotes. */
export const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
export const PROVISION_PATH = "/api/v1/keys/provision";
/** A random per-install id, so per-machine limits apply to this machine and not its whole network. */
export const CLIENT_ID_HEADER = "X-SentiSense-Client-Id";
export const LLMS_URL = "https://sentisense.ai/llms.txt";
export const SKILL_URL = "https://sentisense.ai/skill.md";

/** What the server answers when it mints a temporary key. */
export interface ProvisionedKey {
  apiKey: string;
  /** Epoch seconds: when the key stops working unless kept. */
  expiresAt: number;
  /** Epoch seconds: until when the key can still be kept, later than `expiresAt`. */
  keepUntil?: number;
  keepUrl: string;
  limits?: { requestsPerMinute?: number; requestsPerDay?: number; requestsTotal?: number };
}

/** Where an already-configured key came from, in words a person reads once and understands. */
const SOURCE_TEXT: Record<"flag" | "env" | "config", string> = {
  config: 'your own key saved with "sentisense auth"',
  flag: "the key passed with --api-key",
  env: "the key in your SENTISENSE_API_KEY environment variable",
};

const BY_HAND = `get a free key at ${KEY_URL}.`;

/** `2026-10-20 18:00 UTC`, from epoch seconds. */
export function formatUtc(epochSeconds: number): string {
  return `${new Date(epochSeconds * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function isProvisionedKey(value: unknown): value is ProvisionedKey {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.apiKey === "string" &&
    KEY_PATTERN.test(body.apiKey) &&
    typeof body.expiresAt === "number" &&
    Number.isFinite(body.expiresAt) &&
    typeof body.keepUrl === "string" &&
    /^https?:\/\/\S+$/.test(body.keepUrl)
  );
}

/** Ask the API for a temporary key. Every refusal becomes one error with the way forward. */
async function mintKey(context: Parameters<typeof createClient>[0]): Promise<ProvisionedKey> {
  const client = createClient(context, { anonymous: true });
  const installId = readOrCreateInstallId(context.configDir);
  let answer: unknown;
  try {
    answer = await client.post<unknown>(PROVISION_PATH, {}, installId ? { [CLIENT_ID_HEADER]: installId } : undefined);
  } catch (error) {
    // 404: the endpoint is switched off. 401: a server that predates it, where every keyless call
    // is refused. Either way, this server does not hand out keys here.
    if (error instanceof NotFoundError || (error instanceof AuthenticationError && error.status === 401)) {
      throw new CliCommandError("this SentiSense server does not hand out keys from the command line.", BY_HAND, EXIT.AUTH);
    }
    if (error instanceof RateLimitError && error.code === "keep_existing_key") {
      throw new CliCommandError(
        error.message,
        `open the keep link that came with the key init gave you before and sign in, or ${BY_HAND}`,
        EXIT.RATE_LIMIT,
      );
    }
    if (error instanceof RateLimitError) {
      throw new CliCommandError(error.message, BY_HAND, EXIT.RATE_LIMIT);
    }
    // New keys paused for the day: the server says so in its own words, and waiting is the answer.
    if (error instanceof SentiSenseError && error.code === "provision_paused") {
      throw new CliCommandError(error.message, `try again after 00:00 UTC, or ${BY_HAND}`, EXIT.RATE_LIMIT);
    }
    if (error instanceof AuthenticationError) {
      throw new CliCommandError(error.message, BY_HAND, EXIT.AUTH);
    }
    if (error instanceof SentiSenseError && error.status !== undefined && error.status >= 500) {
      throw new CliCommandError(error.message, `try again in a few minutes, or ${BY_HAND}`, EXIT.ERROR);
    }
    throw error;
  }
  if (!isProvisionedKey(answer)) {
    throw new CliCommandError("the server's answer did not contain a usable key.", BY_HAND, EXIT.ERROR);
  }
  return answer;
}

function limitsText(limits: ProvisionedKey["limits"]): string {
  if (!limits) return "";
  const parts: string[] = [];
  if (limits.requestsPerDay) parts.push(`${limits.requestsPerDay.toLocaleString("en-US")} a day`);
  if (limits.requestsPerMinute) parts.push(`${limits.requestsPerMinute} a minute`);
  if (limits.requestsTotal) {
    const pace = parts.length ? ` (at most ${parts.join(", ")})` : "";
    return ` Until it is kept, the key has ${limits.requestsTotal.toLocaleString("en-US")} requests in all${pace}.`;
  }
  return parts.length ? ` Until it is kept, the key allows ${parts.join(" and ")}.` : "";
}

export const initCommand: CommandDef = {
  name: "init",
  summary: "Get an API key with no signup and print it, with a link to keep it",
  usage: "sentisense init [--new]",
  examples: ["npx sentisense init", "npx sentisense init --json", "npx sentisense init --new"],
  notes: [
    "Runs without prompts, so a coding agent can run it. It writes nothing into your project:",
    "it prints SENTISENSE_API_KEY=<key> and a keep link. Store the key the way the project",
    "already stores secrets (an environment variable, a .env file kept out of git, a secret",
    "manager). The SDK and every sentisense command read SENTISENSE_API_KEY from the environment.",
    "The key is temporary until kept: open the link, sign in or create a free account, and the",
    "same key stays on your account. Until then it stops working after a few days and has request",
    "limits; the link keeps it for about two weeks, even after it stops working.",
    "When a key is already configured (--api-key, the environment, or sentisense auth), init says",
    "so and makes no new one; --new asks for a fresh temporary key anyway.",
    "Exits 3 when no key could be obtained, 5 when today's temporary keys for this network are",
    "used up.",
  ],
  flags: {
    new: { type: "boolean", describe: "Ask for a fresh temporary key even when one is already configured" },
  },
  async run({ args, context }) {
    if (args.positionals.length > 0) {
      throw new CliUsageError(`init takes no arguments, got "${args.positionals[0]}".`, "run it as: sentisense init");
    }

    if (context.apiKey && args.flags.new !== true) {
      const source = context.apiKeySource === "default" ? "config" : context.apiKeySource;
      return {
        json: {
          apiKey: null,
          configured: { source, masked: maskKey(context.apiKey) },
          temporary: false,
          envVar: ENV_VAR,
          docs: { llms: LLMS_URL, skill: SKILL_URL },
        },
        doc: doc(
          { kind: "text", text: `A key is already configured: ${SOURCE_TEXT[source]} (${maskKey(context.apiKey)}).` },
          { kind: "text", text: 'No new key was made. Run "sentisense init --new" for a fresh temporary key.', tone: "dim" },
        ),
      };
    }

    const minted = await mintKey(context);
    const keepWindow = minted.keepUntil ? `; it works until ${formatUtc(minted.keepUntil)}, even after the key stops` : "";
    return {
      json: {
        apiKey: minted.apiKey,
        envVar: ENV_VAR,
        temporary: true,
        expiresAt: minted.expiresAt,
        keepUntil: minted.keepUntil ?? null,
        keepUrl: minted.keepUrl,
        limits: minted.limits ?? null,
        docs: { llms: LLMS_URL, skill: SKILL_URL },
      },
      doc: doc(
        { kind: "text", text: `${ENV_VAR}=${minted.apiKey}` },
        { kind: "blank" },
        {
          kind: "text",
          text:
            `A temporary key, working until ${formatUtc(minted.expiresAt)} unless kept. Set it as the ${ENV_VAR} ` +
            "environment variable wherever this project keeps its secrets; the SDK and the sentisense commands read it from there.",
        },
        { kind: "blank" },
        {
          kind: "text",
          text:
            "Keep this key: open this link and sign in (or create a free account), and the same key " +
            "stays on your account for good. Nothing else changes.",
        },
        { kind: "text", text: minted.keepUrl, tone: "accent" },
        {
          kind: "text",
          text: `Save the link with the key${keepWindow}.${limitsText(minted.limits)}`,
          tone: "dim",
        },
        { kind: "text", text: `API reference for agents: ${LLMS_URL}`, tone: "dim" },
      ),
    };
  },
};
