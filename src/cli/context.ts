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
  skill?: string;
  skillSource: Source;
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
  const skill = pick(flagString(flags, "skill"), env.SENTISENSE_SKILL, stored.skill);

  return {
    configDir: dir,
    apiKey: key.value,
    apiKeySource: key.source,
    baseUrl: base.value,
    baseUrlSource: base.source,
    agentName: agent.value,
    agentSource: agent.source,
    skill: skill.value,
    skillSource: skill.source,
  };
}

export const DEFAULT_BASE_URL = "https://app.sentisense.ai";

export function effectiveBaseUrl(context: ResolvedContext): string {
  return context.baseUrl ?? DEFAULT_BASE_URL;
}

/** Longest identity that reaches the header. Long enough to be recognisable, short enough to be a label. */
const MAX_IDENTITY = 32;

/**
 * Reduces a caller-supplied identity to something that cannot restructure the header.
 *
 * Only `[A-Za-z0-9._-]` survives. That matters more than it looks: the identities are placed
 * inside a parenthesized User-Agent comment, so a stray parenthesis or semicolon would end
 * the comment early and let anything after it read as a separate product token. Runs of
 * whitespace collapse to a single hyphen first, which keeps a two-word name readable without
 * ever letting a space through, since a space would split one identity into two tokens.
 */
export function sanitizeIdentity(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    // Runs of hyphens, and any left dangling at an edge, are what removing the surrounding
    // punctuation leaves behind. They also stop a slug matching the name it was meant to be,
    // which is the entire point of sending one.
    .replace(/-{2,}/g, "-")
    .slice(0, MAX_IDENTITY)
    .replace(/^-+|-+$/g, "");
}

/**
 * What the CLI adds to the SDK's own User-Agent.
 *
 * `sentisense-cli/{version}` is always there, so a call made through the CLI is
 * distinguishable from one made through the library. Anything the caller volunteers about
 * itself rides in a single parenthesized comment after it:
 *
 * ```
 * sentisense-cli/1.0.0
 * sentisense-cli/1.0.0 (my-skill)
 * sentisense-cli/1.0.0 (agent/research-desk)
 * sentisense-cli/1.0.0 (my-skill; agent/research-desk)
 * ```
 *
 * The skill slug leads, on its own, as a bare token. Both details are load-bearing: it is
 * read as a whole token, and only inside the comment, so a slug written any other way in the
 * header is simply not seen. Neither identity is required and nothing is inferred when they
 * are absent, which is why the no-identity form carries no comment at all rather than an
 * empty one.
 */
export function userAgentSuffix(context: ResolvedContext): string {
  const product = `sentisense-cli/${VERSION}`;
  const slug = sanitizeIdentity(context.skill ?? "");
  const agent = sanitizeIdentity(context.agentName ?? "");

  const comment: string[] = [];
  if (slug) comment.push(slug);
  if (agent) comment.push(`agent/${agent}`);

  return comment.length === 0 ? product : `${product} (${comment.join("; ")})`;
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
