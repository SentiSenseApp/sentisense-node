import type { Block, Doc, Field } from "./doc.js";
import { sparkline } from "./num.js";

/**
 * Token-lean text with zero escape codes: the default whenever output is not a terminal.
 *
 * Every reading arrives as `label: value` on its own line, aligned on the value column, so a
 * reader (human or model) never has to infer which number it is looking at from position.
 */

function padEnd(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function padStart(text: string, width: number): string {
  return text.length >= width ? text : " ".repeat(width - text.length) + text;
}

function renderFields(items: Field[]): string[] {
  if (items.length === 0) return [];
  const width = Math.max(...items.map((f) => f.label.length + 1));
  return items.map((f) => `${padEnd(`${f.label}:`, width)} ${f.value.text}`);
}

function renderBlock(block: Block): string[] {
  switch (block.kind) {
    case "head":
      return renderFields([block.title, ...(block.subtitle ? [block.subtitle] : []), ...(block.right ?? [])]);
    case "facts":
    case "kv":
      return renderFields(block.items);
    case "spark": {
      const line = `${block.label}: ${sparkline(block.series)}`;
      return block.note ? [line, `${block.label} note: ${block.note}`] : [line];
    }
    case "table": {
      if (block.rows.length === 0) return [];
      const widths = block.head.map((header, i) =>
        Math.max(header.length, ...block.rows.map((row) => row[i]?.text.length ?? 0)),
      );
      const align = (i: number) => block.align?.[i] ?? "left";
      const pad = (text: string, i: number) =>
        align(i) === "right" ? padStart(text, widths[i]) : padEnd(text, widths[i]);
      const line = (cells: string[]) =>
        cells
          .map((text, i) => pad(text, i))
          .join("  ")
          .trimEnd();
      return [
        line(block.head),
        ...block.rows.map((row) => line(block.head.map((_, i) => row[i]?.text ?? ""))),
      ];
    }
    case "text":
      return [block.text];
    case "blank":
      return [""];
  }
}

export function renderPlain(document: Doc): string {
  const lines: string[] = [];
  for (const block of document.blocks) lines.push(...renderBlock(block));
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}
