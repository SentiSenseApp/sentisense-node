import type { APIClient } from "../client.js";
import type { KBEntity } from "../types.js";

export class KB {
  constructor(private client: APIClient) {}

  /** Get popular entities for search suggestions. */
  async getPopularEntities(): Promise<KBEntity[]> {
    return this.client.get("/api/v1/kb/entities/popular");
  }

  /** Get entity detail with metrics and relationships. */
  async getEntity(entityId: string): Promise<KBEntity> {
    return this.client.get(`/api/v1/kb/entities/${encodeURIComponent(entityId)}`);
  }

  /** Get all tracked entities. */
  async getAllEntities(): Promise<KBEntity[]> {
    return this.client.get("/api/v1/kb/entities/all");
  }
}
