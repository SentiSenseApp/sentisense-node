import type { APIClient } from "../client.js";
import type { MarketMood } from "../types.js";

export class MarketMoodResource {
  constructor(private client: APIClient) {}

  /** Get market mood data (scores, history, sectors). */
  async get(): Promise<MarketMood> {
    return this.client.get("/api/v2/market-mood");
  }

  // TODO: accept a `days` param to control history length (the endpoint supports ?days=N).
  //
  // Market Mood is also reachable through `client.indexes`, which serves it in the shared
  // index envelope alongside fed-sentiment and ai-sentiment. Use this resource when you want
  // the phase band, weekly change, per-signal breakdown and per-sector map; use `indexes`
  // when you want every index to answer the same shape. Both report the same headline number.
}
