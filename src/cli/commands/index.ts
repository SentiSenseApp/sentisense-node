import type { CommandDef } from "../command.js";
import { analystCommand } from "./analyst.js";
import { analystsCommand } from "./analysts.js";
import { authCommand } from "./auth.js";
import { congressCommand } from "./congress.js";
import { earningsCommand } from "./earnings.js";
import { flowsCommand } from "./flows.js";
import { healthCommand } from "./health.js";
import { insidersCommand } from "./insiders.js";
import { insightsCommand } from "./insights.js";
import { moodCommand } from "./mood.js";
import { newsCommand } from "./news.js";
import { optionsCommand } from "./options.js";
import { quoteCommand } from "./quote.js";
import { screenCommand } from "./screen.js";
import { searchCommand } from "./search.js";
import { sentimentCommand } from "./sentiment.js";

/** Order is the order help prints: setup first, then the data commands by how often they run. */
export const COMMANDS: CommandDef[] = [
  authCommand,
  healthCommand,
  quoteCommand,
  sentimentCommand,
  moodCommand,
  analystsCommand,
  analystCommand,
  earningsCommand,
  insidersCommand,
  insightsCommand,
  congressCommand,
  newsCommand,
  flowsCommand,
  optionsCommand,
  screenCommand,
  searchCommand,
];

export const COMMAND_NAMES: string[] = COMMANDS.map((command) => command.name);

export function findCommand(name: string): CommandDef | undefined {
  return COMMANDS.find((command) => command.name === name);
}

/** Commands that read only local settings and never build a client. */
export const OFFLINE_COMMANDS = new Set(["auth"]);
