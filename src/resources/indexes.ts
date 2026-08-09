import type { APIClient } from "../client.js";
import type {
  IndexConstituent,
  IndexHistoryPoint,
  IndexHistoryResponse,
  IndexListing,
  IndexListResponse,
  IndexSnapshot,
} from "../types.js";

/**
 * Indexes: composite scalars tracked over time, each blending its own inputs
 * into one number on a stated scale. Every index answers on the same envelope,
 * so you write one renderer and get every current and future SentiSense index.
 *
 * Two archetypes share that envelope. A **basket** index weight-averages
 * tracked entities and fills `constituents` / `basketSize` / `coverage` /
 * `totalMentions`; a **composite** index is built from signals instead and
 * returns `null` for all four by construction. See {@link IndexSnapshot}.
 *
 * @see IndexSnapshot
 */
export class Indexes {
  constructor(private client: APIClient) {}

  /**
   * List every index the platform publishes: id, display name, one-line
   * description, the scale it lives on, its access tier, and where its richest
   * view lives.
   *
   * Iterate this rather than hardcoding ids. Every `indexId` it advertises
   * resolves on {@link get} and {@link history}.
   */
  async list(): Promise<IndexListResponse> {
    return this.client.get("/api/v1/indexes");
  }

  /**
   * Latest reading for one index.
   *
   * Check `constituents` for `null` before iterating: it is `null` on a
   * composite index like `market-mood`, which has no constituents by
   * construction. For Market Mood this is the narrowed view; the phase band,
   * weekly change, per-signal breakdown and per-sector map live on
   * `client.marketMood.get()`, and both report the same headline number.
   *
   * @param indexId slug from {@link list}, e.g. `"fed-sentiment"`.
   */
  async get(indexId: string): Promise<IndexSnapshot> {
    return this.client.get(`/api/v1/indexes/${indexId}`);
  }

  /**
   * Historical scalar series for one index, for charting.
   *
   * Thin or low-coverage buckets are withheld, so the series can be shorter
   * than `days` and can contain gaps. Plot against each point's `date`.
   *
   * @param indexId slug from {@link list}.
   * @param days days of history to return. Defaults to the API's own 180.
   */
  async history(indexId: string, days?: number): Promise<IndexHistoryResponse> {
    return this.client.get(
      `/api/v1/indexes/${indexId}/history`,
      days === undefined ? undefined : { days },
    );
  }
}

// Re-export for convenience so callers can `import type { IndexListing }`
// from the resource module instead of `../types`.
export type {
  IndexConstituent,
  IndexHistoryPoint,
  IndexHistoryResponse,
  IndexListing,
  IndexListResponse,
  IndexSnapshot,
};
