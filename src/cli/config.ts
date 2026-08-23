import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * The stored CLI settings.
 *
 * Deliberately small: a key, two optional identity labels the caller chooses to send, and an
 * optional base URL for anyone pointing the CLI somewhere other than production.
 */
export interface CliConfig {
  apiKey?: string;
  agentName?: string;
  /** Slug of the skill driving the CLI. Voluntary, and only ever what the caller set. */
  skill?: string;
  baseUrl?: string;
}

export const CONFIG_FILE = "config.json";

/**
 * Where settings live: an explicit override wins, then the XDG location, then the usual
 * `~/.config/sentisense`.
 */
export function resolveConfigDir(
  env: Record<string, string | undefined>,
  override?: string,
): string {
  if (override) return override;
  const explicit = env.SENTISENSE_CONFIG_DIR?.trim();
  if (explicit) return explicit;
  const xdg = env.XDG_CONFIG_HOME?.trim();
  if (xdg) return join(xdg, "sentisense");
  return join(homedir(), ".config", "sentisense");
}

export function configPath(dir: string): string {
  return join(dir, CONFIG_FILE);
}

/**
 * Reads the stored settings, treating a missing or unreadable file as "nothing stored".
 *
 * A corrupt config must not break every command: the key can still come from the
 * environment, and `sentisense auth <key>` overwrites the file anyway.
 */
export function readConfig(dir: string): CliConfig {
  const path = configPath(dir);
  if (!existsSync(path)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const raw = parsed as Record<string, unknown>;
    const config: CliConfig = {};
    if (typeof raw.apiKey === "string") config.apiKey = raw.apiKey;
    if (typeof raw.agentName === "string") config.agentName = raw.agentName;
    if (typeof raw.skill === "string") config.skill = raw.skill;
    if (typeof raw.baseUrl === "string") config.baseUrl = raw.baseUrl;
    return config;
  } catch {
    return {};
  }
}

/**
 * Writes settings owner-readable only.
 *
 * The mode on `writeFileSync` applies when the file is created, so an existing file keeps
 * whatever permissions it already had. The explicit `chmod` afterwards is what makes 0600
 * true for a rewrite as well as a first write.
 */
export function writeConfig(dir: string, config: CliConfig): string {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = configPath(dir);
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  return path;
}

/** Removes the stored settings. Returns false when there was nothing to remove. */
export function clearConfig(dir: string): boolean {
  const path = configPath(dir);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

/** `ssk_live_1234...cdef`. Enough to recognise a key, never enough to use one. */
export function maskKey(key: string): string {
  // Reveal nothing from the key itself: even a prefix/suffix fingerprint can land in
  // logs, transcripts, or CI output. Length + the separately-reported source is enough
  // to tell which key is configured.
  return `hidden (${key.length} chars)`;
}
