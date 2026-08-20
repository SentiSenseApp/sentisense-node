import type { CommandDef } from "../command.js";
import { clearConfig, configPath, maskKey, readConfig, writeConfig } from "../config.js";
import { KEY_URL } from "../errors.js";
import { doc, field, fields } from "../render/doc.js";

export const authCommand: CommandDef = {
  name: "auth",
  summary: "Store an API key, show what is configured, or remove it",
  usage: "sentisense auth [<key>] [--agent <name>] [--skill <slug>] [--remove]",
  examples: [
    "sentisense auth $SENTISENSE_API_KEY",
    "sentisense auth --agent research-desk",
    "sentisense auth --skill stock-analysis --agent research-desk",
    "sentisense auth",
    "sentisense auth --remove",
  ],
  notes: [
    "Settings live in config.json under $SENTISENSE_CONFIG_DIR, $XDG_CONFIG_HOME/sentisense,",
    "or ~/.config/sentisense, written owner-readable only (0600).",
    "The key is never printed back in full, and never has to be pasted into a command again.",
    "Two optional labels say who is calling: --agent is what your agent calls itself, and",
    "--skill is the slug of the skill driving it. When set, they ride along in the",
    "User-Agent, so usage can be understood and the tools improved. Both are voluntary and",
    "nothing needs them to work.",
  ],
  flags: {
    remove: { type: "boolean", describe: "Delete the stored settings" },
  },
  async run({ args, context }) {
    const dir = context.configDir;
    const path = configPath(dir);

    if (args.flags.remove === true) {
      const removed = clearConfig(dir);
      return {
        json: { removed, path },
        doc: doc(
          { kind: "text", text: removed ? `Removed ${path}` : `Nothing stored at ${path}` },
        ),
      };
    }

    const key = args.positionals[0];
    const agent = typeof args.flags.agent === "string" ? args.flags.agent : undefined;
    const skill = typeof args.flags.skill === "string" ? args.flags.skill : undefined;
    const baseUrl = typeof args.flags["base-url"] === "string" ? args.flags["base-url"] : undefined;

    if (key || agent || skill || baseUrl) {
      const stored = readConfig(dir);
      const next = {
        ...stored,
        ...(key ? { apiKey: key } : {}),
        ...(agent ? { agentName: agent } : {}),
        ...(skill ? { skill } : {}),
        ...(baseUrl ? { baseUrl } : {}),
      };
      writeConfig(dir, next);
      return {
        json: {
          path,
          apiKey: next.apiKey ? maskKey(next.apiKey) : null,
          agentName: next.agentName ?? null,
          skill: next.skill ?? null,
          baseUrl: next.baseUrl ?? null,
        },
        doc: doc(
          { kind: "text", text: `Saved to ${path}` },
          {
            kind: "kv",
            items: fields(
              next.apiKey ? field("api key", maskKey(next.apiKey)) : undefined,
              next.agentName ? field("agent", next.agentName) : undefined,
              next.skill ? field("skill", next.skill) : undefined,
              next.baseUrl ? field("base url", next.baseUrl) : undefined,
            ),
          },
        ),
      };
    }

    const stored = readConfig(dir);
    const resolved = context.apiKey;
    return {
      json: {
        path,
        configured: Boolean(stored.apiKey),
        apiKey: resolved ? maskKey(resolved) : null,
        apiKeySource: context.apiKeySource,
        agentName: context.agentName ?? null,
        skill: context.skill ?? null,
        baseUrl: context.baseUrl ?? null,
      },
      doc: doc(
        {
          kind: "kv",
          items: fields(
            field("api key", resolved ? maskKey(resolved) : "not configured"),
            field("source", resolved ? context.apiKeySource : "none"),
            field("config", path),
            context.agentName ? field("agent", context.agentName) : undefined,
            context.skill ? field("skill", context.skill) : undefined,
            context.baseUrl ? field("base url", context.baseUrl) : undefined,
          ),
        },
        resolved
          ? undefined
          : {
              kind: "text",
              text: `Store one with "sentisense auth <key>". Get a key at ${KEY_URL}`,
            },
      ),
    };
  },
};
