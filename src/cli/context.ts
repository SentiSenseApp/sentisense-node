import { SentiSense } from "../client.js";
import { VERSION } from "../version.js";
import { readConfig, resolveConfigDir } from "./config.js";
import { MissingKeyError } from "./errors.js";
import { flagString, type Flags } from "./parse.js";

export type Source = "flag" | "env" | "config" | "default";

export interface ResolvedContext {
  configDir: string;
  apiKey?: string;
  apiKeySource: Source;
  baseUrl?: string;
  baseUrlSource: Source;
  agentName?: string;
  agentSource: Source;
}

export interface ContextInputs {
  flags: Flags;
  env: Record<string, string | undefined>;
  configDir?: string;
}

/**
 * Settings resolve flag first, then environment, then the stored config file.
 *
 * That order is what makes the CLI usable in three situations at once: a one-off override on
 * the command line, an environment already carrying a key in CI, and a machine set up once
 * with `sentisense auth`.
 */
export function resolveContext({ flags, env, configDir }: ContextInputs): ResolvedContext {
  const dir = resolveConfigDir(env, configDir);
  const stored = readConfig(dir);

  const pick = (
    flagValue: string | undefined,
    envValue: string | undefined,
    configValue: string | undefined,
  ): { value?: string; source: Source } => {
    if (flagValue) return { value: flagValue, source: "flag" };
    if (envValue && envValue.trim()) return { value: envValue.trim(), source: "env" };
    if (configValue) return { value: configValue, source: "config" };
    return { source: "default" };
  };

  const key = pick(flagString(flags, "api-key"), env.SENTISENSE_API_KEY, stored.apiKey);
  const base = pick(flagString(flags, "base-url"), env.SENTISENSE_BASE_URL, stored.baseUrl);
  const agent = pick(flagString(flags, "agent"), env.SENTISENSE_AGENT_NAME, stored.agentName);

  return {
    configDir: dir,
    apiKey: key.value,
    apiKeySource: key.source,
    baseUrl: base.value,
    baseUrlSource: base.source,
    agentName: agent.value,
    agentSource: agent.source,
  };
}

export const DEFAULT_BASE_URL = "https://app.sentisense.ai";

export function effectiveBaseUrl(context: ResolvedContext): string {
  return context.baseUrl ?? DEFAULT_BASE_URL;
}

/** Header-safe agent label: one token, no spaces, nothing exotic. */
export function sanitizeAgent(name: string): string {
  return name.trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9._-]/g, "");
}

/**
 * What the CLI adds to the SDK's own User-Agent, so calls made through the CLI are
 * distinguishable from calls made through the library, and an agent that names itself is
 * distinguishable from one that does not.
 */
export function userAgentSuffix(context: ResolvedContext): string {
  const parts = [`sentisense-cli/${VERSION}`];
  const agent = context.agentName ? sanitizeAgent(context.agentName) : "";
  if (agent) parts.push(`agent/${agent}`);
  return parts.join(" ");
}

export interface ClientOptions {
  /** Build a client with no key, for a probe that only needs to know the host answers. */
  anonymous?: boolean;
}

/**
 * A client wired for one CLI invocation.
 *
 * `maxRetries: 0` is deliberate. The library retries a 429 by sleeping for as long as the
 * server asks, which is right for a long-lived process and wrong for a command: the caller
 * would sit there for a minute with no output. The CLI fails fast with exit code 5 instead
 * and lets the caller decide when to come back.
 */
export function createClient(context: ResolvedContext, options: ClientOptions = {}): SentiSense {
  if (!options.anonymous && !context.apiKey) throw new MissingKeyError();
  return new SentiSense({
    apiKey: options.anonymous ? undefined : context.apiKey,
    baseUrl: context.baseUrl,
    maxRetries: 0,
    userAgentSuffix: userAgentSuffix(context),
  });
}
