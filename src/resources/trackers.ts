import type { APIClient } from "../client.js";
import type {
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
   * @param params provider-specific query params (e.g. `{ scope: "us" }` for
   *   geographically-scoped trackers like hantavirus). Unknown keys are ignored.
   */
  async get(
    trackerId: string,
    params?: Record<string, string | number | boolean>,
  ): Promise<TrackerSnapshotResponse> {
    return this.client.get(`/api/v1/trackers/${trackerId}`, params);
  }
}

// Re-export for convenience so callers can `import type { TrackerListing }`
// from the resource module instead of `../types`.
export type {
  TrackerListing,
  TrackerListResponse,
  TrackerSnapshot,
  TrackerSnapshotResponse,
};
