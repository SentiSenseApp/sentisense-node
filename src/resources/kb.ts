import type { APIClient } from "../client.js";
import type { KBEntity } from "../types.js";

/** Public entity types the search `type` filter accepts, and that come back on a hit. */
export type EntitySearchType =
  | "person"
  | "company"
  | "product"
  | "organization"
  | "etf"
  | "topic"
  | "country";

/**
 * One ranked match from {@link KB.searchEntities}.
 *
 * `urlSlug` is the handle the metric endpoints address an entity by, which is the reason
 * this endpoint exists: it answers "what is the handle for the thing I typed".
 */
export interface EntitySearchResult {
  name: string;
  /** Stable handle for this entity, or `null` when it has none. */
  urlSlug: string | null;
  /** `"person"`, `"company"`, `"product"`, `"organization"`, `"etf"`, `"topic"`, `"country"`. */
  type: EntitySearchType | string | null;
  /** The listed symbol for a tradeable entity, `null` for everything else. */
  ticker: string | null;
}

export interface SearchEntitiesOptions {
  /** Narrow to one entity type. An unrecognised value is rejected with a 400. */
  type?: EntitySearchType | string;
  /** Matches to return, 1 to 25. Omitted, the API applies its own default of 10. */
  limit?: number;
}

export class KB {
  constructor(private client: APIClient) {}

  /** Get popular entities for search suggestions. */
  async getPopularEntities(): Promise<KBEntity[]> {
    return this.client.get("/api/v1/kb/entities/popular");
  }

  /**
   * Resolve a name, alias, ticker or slug to the entities we track, best match first.
   *
   * This is resolution, not enumeration: the query must be at least 2 characters and the
   * result count is capped, so it answers "which handle did the user mean" rather than
   * dumping the graph. Use it when someone typed "Tesla" and the rest of your code needs
   * `TSLA`, or when you need the `urlSlug` an entity's metric series is addressed by.
   *
   * Returns a bare array, not a `PreviewResponse` envelope, and an empty array is the
   * normal answer for a query that matches nothing.
   *
   * @param q What the user typed. At least 2 characters, or the API answers 400.
   */
  async searchEntities(
    q: string,
    options?: SearchEntitiesOptions,
  ): Promise<EntitySearchResult[]> {
    return this.client.get("/api/v1/kb/entities/search", { q, ...options });
  }
}
