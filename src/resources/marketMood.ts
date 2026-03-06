import type { APIClient } from "../client.js";
import type { MarketMood } from "../types.js";

export class MarketMoodResource {
  constructor(private client: APIClient) {}

  /** Get market mood data (scores, history, sectors). */
  async get(): Promise<MarketMood> {
    return this.client.get("/api/v2/market-mood");
  }
}
