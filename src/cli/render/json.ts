/**
 * The API response, exactly as it arrived.
 *
 * Nothing is unwrapped, renamed, or filled in: `isPreview`, `previewReason` and `totalCount`
 * stay where the server put them, because a caller branching on tier needs to see them. When
 * a command makes more than one request, the responses are keyed by what they are, and each
 * value is still the untouched response body.
 */
export function renderJson(payload: unknown): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}
