/**
 * The neutral document every command produces.
 *
 * Commands never format for a terminal. They describe what they found as blocks, and the
 * pretty / plain renderers decide how that looks. One consequence worth keeping: a fact
 * carries its own label even when the pretty layout does not print it, so the plain
 * renderer never has to invent one.
 */

/** Semantic role of a value. Colour is derived from this, never chosen at the call site. */
export type Tone = "up" | "down" | "accent" | "dim";

export interface Cell {
  text: string;
  tone?: Tone;
}

export interface Field {
  label: string;
  value: Cell;
}

export type Block =
  /** Answer-first line: what this is, and the one number that matters. */
  | { kind: "head"; title: Field; subtitle?: Field; right?: Field[] }
  /** A run of short readings. One line in pretty, one line each in plain. */
  | { kind: "facts"; items: Field[] }
  /** Label / value pairs, one per line in both modes. */
  | { kind: "kv"; items: Field[] }
  | { kind: "spark"; label: string; series: number[]; note?: string }
  | { kind: "table"; head: string[]; rows: Cell[][]; align?: Array<"left" | "right"> }
  | { kind: "text"; text: string; tone?: Tone }
  | { kind: "blank" };

export interface Doc {
  blocks: Block[];
}

export function cell(text: string, tone?: Tone): Cell {
  return tone ? { text, tone } : { text };
}

export function field(label: string, text: string, tone?: Tone): Field {
  return { label, value: cell(text, tone) };
}

/** Drops undefined entries so a command can build a block with optional rows inline. */
export function fields(...items: Array<Field | undefined>): Field[] {
  return items.filter((item): item is Field => item !== undefined);
}

export function doc(...blocks: Array<Block | undefined>): Doc {
  return { blocks: blocks.filter((block): block is Block => block !== undefined) };
}
