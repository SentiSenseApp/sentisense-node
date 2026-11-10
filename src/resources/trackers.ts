import type { APIClient } from "../client.js";
import type {
  TrackerFilter,
  TrackerGetParams,
  TrackerListing,
  TrackerListResponse,
  TrackerSnapshot,
  TrackerSnapshotResponse,
} from "../types.js";

/**
 * Trackers: observational data products published as a standardized
 * `TrackerSnapshot` envelope. Every tracker (institution rankings,
 * hedge-fund reported returns, social trackers, surveillance dashboards)
 * returns the same shape, so consumers write one renderer per `viewType` and
 * get every current and future SentiSense tracker for free.
 *
 * @see TrackerSnapshot
 */
export class Trackers {
  constructor(private client: APIClient) {}

  /**
   * List every publicly-visible tracker: id, display name, category,
   * one-line description, and the methodology anchor to link out to.
   */
  async list(): Promise<TrackerListResponse> {
    return this.client.get("/api/v1/trackers");
  }

  /**
   * Standardized snapshot envelope for one tracker.
   *
   * Returns the envelope as-is: `{ isPreview, previewReason, totalCount?, data }`.
   * When `data.viewType === "table"` the rows live at `data.rows[]`; when
   * `"choropleth"` they live at `data.geo[]`; etc. Dispatch on `viewType`
   * in your renderer.
   *
   * @param trackerId slug from {@link list}, e.g. `"institution-concentration"`.
   * @param params provider-specific query params, e.g. `{ scope: "nasdaq100" }` for
   *   `market-heatmap`, or `{ filter: { state: "TX" } }` for a tracker that lists
   *   `filters`. A bad `filter` throws `APIError` with `code: "invalid_filter"`.
   */
  async get(trackerId: string, params?: TrackerGetParams): Promise<TrackerSnapshotResponse> {
    return this.client.get(`/api/v1/trackers/${trackerId}`, serializeTrackerParams(params));
  }
}

/**
 * Serialize a tracker filter to the wire form `key:value,key:value`. A string passes through
 * unchanged; an object keeps its key order, so `{ state: "TX", category: "local" }` becomes
 * `"state:TX,category:local"`.
 */
export function serializeTrackerFilter(filter: string | Record<string, string>): string {
  if (typeof filter === "string") return filter;
  return Object.entries(filter)
    .map(([key, value]) => `${key}:${value}`)
    .join(",");
}

function serializeTrackerParams(
  params?: TrackerGetParams,
): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    out[key] = key === "filter" ? serializeTrackerFilter(value as string | Record<string, string>) : (value as string | number | boolean);
  }
  return out;
}

// Re-export for convenience so callers can `import type { TrackerListing }`
// from the resource module instead of `../types`.
export type {
  TrackerFilter,
  TrackerGetParams,
  TrackerListing,
  TrackerListResponse,
  TrackerSnapshot,
  TrackerSnapshotResponse,
};
