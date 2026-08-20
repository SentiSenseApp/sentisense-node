/** What every renderer prints when a value is genuinely absent. Never `0`, never blank. */
export const ABSENT = "n/a";

const SPARK_LEVELS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Trims the trailing zeros a fixed-decimal format leaves behind: 4.20 becomes 4.2. */
function trim(text: string): string {
  return text.includes(".") ? text.replace(/\.?0+$/, "") : text;
}

export function fixed(value: unknown, decimals = 2): string {
  return isNum(value) ? value.toFixed(decimals) : ABSENT;
}

/** Compact magnitude: 1.24B, 4.2k, 812. Keeps the sign. */
export function humanize(value: unknown, decimals = 2): string {
  if (!isNum(value)) return ABSENT;
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const units: Array<[number, string]> = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "k"],
  ];
  for (const [scale, suffix] of units) {
    if (abs >= scale) return `${sign}${trim((abs / scale).toFixed(decimals))}${suffix}`;
  }
  return `${sign}${trim(abs.toFixed(decimals))}`;
}

export function signed(value: unknown, decimals = 2): string {
  if (!isNum(value)) return ABSENT;
  return `${value > 0 ? "+" : ""}${value.toFixed(decimals)}`;
}

export function signedPercent(value: unknown, decimals = 2): string {
  if (!isNum(value)) return ABSENT;
  return `${value > 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export function percent(value: unknown, decimals = 1): string {
  return isNum(value) ? `${value.toFixed(decimals)}%` : ABSENT;
}

export function money(value: unknown, decimals = 2): string {
  return isNum(value) ? `$${value.toFixed(decimals)}` : ABSENT;
}

/** Direction of a change, for colour. Zero and absent are both neutral. */
export function direction(value: unknown): "up" | "down" | undefined {
  if (!isNum(value) || value === 0) return undefined;
  return value > 0 ? "up" : "down";
}

/**
 * Eight-level block sparkline.
 *
 * Non-finite points render as a space rather than being dropped, so the line stays the same
 * length as the series and a gap reads as a gap. A flat series sits on the middle level
 * instead of the floor, because a floor would read as "collapsed to the low".
 */
export function sparkline(series: Array<number | null | undefined>): string {
  const numbers = series.filter(isNum);
  if (numbers.length === 0) return "";
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const span = max - min;
  return series
    .map((point) => {
      if (!isNum(point)) return " ";
      if (span === 0) return SPARK_LEVELS[3];
      const level = Math.round(((point - min) / span) * (SPARK_LEVELS.length - 1));
      return SPARK_LEVELS[level];
    })
    .join("");
}

/** Epoch milliseconds to `YYYY-MM-DD HH:MM UTC`. */
export function timestamp(ms: unknown): string {
  if (!isNum(ms)) return ABSENT;
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** Epoch seconds to `YYYY-MM-DD`. */
export function dateFromSeconds(seconds: unknown): string {
  if (!isNum(seconds)) return ABSENT;
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}
