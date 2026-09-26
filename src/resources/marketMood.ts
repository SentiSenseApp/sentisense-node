import type { APIClient } from "../client.js";
import type { MarketMood, MarketMoodOptions } from "../types.js";

export class MarketMoodResource {
  constructor(private client: APIClient) {}

  /**
   * Get market mood data (scores, history, sectors).
   *
   * @param options `days` sets how many days of history to return. Omit it to get the
   *                API's default of 180.
   */
  get(options?: MarketMoodOptions): Promise<MarketMood>;
  // The zero-argument signature stays, and stays last, so a bound `get` still type-checks
  // wherever the old no-argument method was passed as a callback.
  get(): Promise<MarketMood>;
  async get(options?: MarketMoodOptions): Promise<MarketMood> {
    // `?.` keeps a plain-JS `get(null)` working, as it did before `get` took options.
    const days = options?.days;
    return this.client.get(
      "/api/v2/market-mood",
      days === undefined ? undefined : { days },
    );
  }

  // Market Mood is also reachable through `client.indexes`, which serves it in the shared
  // index envelope alongside fed-sentiment and ai-sentiment. Use this resource when you want
  // the phase band, weekly change, per-signal breakdown and per-sector map; use `indexes`
  // when you want every index to answer the same shape. Both report the same headline number.
}
