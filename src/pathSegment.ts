import { SentiSenseError } from "./errors.js";

/** The `code` of the error a refused path argument throws. No request was sent. */
export const INVALID_ARGUMENT = "invalid_argument";

/**
 * Put one caller argument into a request path as exactly one segment.
 *
 * The value is percent-encoded, so `/`, `?`, `#`, `%` and spaces stay inside the segment and
 * cannot move the request to another route. An empty or whitespace-only value would leave the
 * segment blank, and a standalone `"."` or `".."` is removed by URL normalization, which also
 * sends the request to a different route. Those are refused with a `SentiSenseError` whose `code`
 * is `"invalid_argument"` (and `status` undefined), before any request is made.
 *
 * @param method The public method name, for the error message (e.g. `"indexes.get"`).
 * @param name   The argument name, for the error message (e.g. `"indexId"`).
 * @param value  The argument as the caller passed it. A finite number is sent as its decimal text.
 * @internal
 */
export function pathSegment(method: string, name: string, value: unknown): string {
  const text =
    typeof value === "string"
      ? value
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : undefined;
  if (text === undefined || text.trim() === "" || text === "." || text === "..") {
    throw new SentiSenseError(
      `${method}: ${name} must not be empty, "." or ".." (got ${JSON.stringify(value)})`,
      undefined,
      INVALID_ARGUMENT,
    );
  }
  return encodeURIComponent(text);
}
