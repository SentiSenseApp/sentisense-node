import type { Tone } from "./doc.js";

const CODES: Record<Tone | "bold", string> = {
  up: "32",
  down: "31",
  accent: "33",
  dim: "2",
  bold: "1",
};

export interface Styler {
  enabled: boolean;
  tone(text: string, tone?: Tone): string;
  bold(text: string): string;
  dim(text: string): string;
}

const ESC = "\u001b";

function wrap(text: string, code: string): string {
  return `${ESC}[${code}m${text}${ESC}[0m`;
}

export function createStyler(enabled: boolean): Styler {
  if (!enabled) {
    const passthrough = (text: string) => text;
    return { enabled: false, tone: passthrough, bold: passthrough, dim: passthrough };
  }
  return {
    enabled: true,
    tone: (text, tone) => (tone ? wrap(text, CODES[tone]) : text),
    bold: (text) => wrap(text, CODES.bold),
    dim: (text) => wrap(text, CODES.dim),
  };
}

export interface ColorInputs {
  pretty: boolean;
  noColorFlag: boolean;
  env: Record<string, string | undefined>;
  isTTY?: boolean;
}

/**
 * Colour is opt-out three ways and opt-in once: the layout has to be pretty, the caller must
 * not have said no (`--no-color`, or a `NO_COLOR` with any value at all, per no-color.org),
 * and the stream has to be a terminal. Forcing `--pretty` into a pipe therefore gets the
 * layout without the escape codes, which is what a caller capturing output wants.
 */
export function shouldColor({ pretty, noColorFlag, env, isTTY }: ColorInputs): boolean {
  if (!pretty || noColorFlag) return false;
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") return false;
  return isTTY === true;
}
