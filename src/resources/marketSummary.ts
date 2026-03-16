import type { APIClient } from "../client.js";
import type { MarketSummary } from "../types.js";

export class MarketSummaryResource {
  constructor(private client: APIClient) {}

  /** Get the AI-generated market summary with headline and analysis. */
  async get(): Promise<MarketSummary> {
    return this.client.get("/api/v1/market-summary");
  }
}
