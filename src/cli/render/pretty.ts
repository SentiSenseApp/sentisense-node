import { createStyler, type Styler } from "./ansi.js";
import type { Block, Doc } from "./doc.js";
import { sparkline } from "./num.js";

/**
 * Fixed layout width.
 *
 * Not the real terminal width on purpose: output that reflows with the window is impossible
 * to pin in a test, and 78 columns fits every terminal anyone actually uses.
 */
const WIDTH = 78;

function padEnd(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function padStart(text: string, width: number): string {
  return text.length >= width ? text : " ".repeat(width - text.length) + text;
}

function renderBlock(block: Block, s: Styler): string[] {
  switch (block.kind) {
    case "head": {
      const left = block.subtitle
        ? `${s.bold(block.title.value.text)}  ${s.dim(block.subtitle.value.text)}`
        : s.bold(block.title.value.text);
      const plainLeftWidth =
        block.title.value.text.length +
        (block.subtitle ? block.subtitle.value.text.length + 2 : 0);
      if (!block.right || block.right.length === 0) return [left];
      const rightPlain = block.right.map((f) => f.value.text).join("  ");
      const right = block.right.map((f) => s.tone(f.value.text, f.value.tone)).join("  ");
      const gap = Math.max(2, WIDTH - plainLeftWidth - rightPlain.length);
      return [`${left}${" ".repeat(gap)}${right}`];
    }
    case "facts":
      if (block.items.length === 0) return [];
      return [
        block.items
          .map((f) => `${s.dim(f.label)} ${s.tone(f.value.text, f.value.tone)}`)
          .join("   "),
      ];
    case "kv": {
      if (block.items.length === 0) return [];
      const width = Math.max(...block.items.map((f) => f.label.length));
      return block.items.map(
        (f) => `${s.dim(padEnd(f.label, width))}  ${s.tone(f.value.text, f.value.tone)}`,
      );
    }
    case "spark": {
      const line = `${s.dim(block.label)} ${sparkline(block.series)}`;
      return [block.note ? `${line}   ${s.dim(block.note)}` : line];
    }
    case "table": {
      if (block.rows.length === 0) return [];
      const columns = block.head.length;
      const widths = block.head.map((header, i) =>
        Math.max(header.length, ...block.rows.map((row) => row[i]?.text.length ?? 0)),
      );
      const align = (i: number) => block.align?.[i] ?? "left";
      const pad = (text: string, i: number) =>
        align(i) === "right" ? padStart(text, widths[i]) : padEnd(text, widths[i]);
      const lines = [
        s.dim(
          block.head
            .map((header, i) => pad(header, i))
            .join("  ")
            .trimEnd(),
        ),
      ];
      for (const row of block.rows) {
        const cells: string[] = [];
        for (let i = 0; i < columns; i++) {
          const value = row[i] ?? { text: "" };
          const padded = pad(value.text, i);
          cells.push(value.tone ? s.tone(padded, value.tone) : padded);
        }
        lines.push(cells.join("  ").trimEnd());
      }
      return lines;
    }
    case "text":
      return [s.tone(block.text, block.tone)];
    case "blank":
      return [""];
  }
}

export function renderPretty(document: Doc, color: boolean): string {
  const s = createStyler(color);
  const lines: string[] = [];
  for (const block of document.blocks) lines.push(...renderBlock(block, s));
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}
