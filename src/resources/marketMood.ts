import type { APIClient } from "../client.js";
import type {
  MarketMood,
  MarketMoodOptions,
  SentimentBreadth,
  SentimentSectors,
} from "../types.js";

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

  /**
   * Get the per-sector sentiment rollup: the 11 GICS sectors, each measured against the
   * market's own news-and-social tone.
   *
   * Compare sectors on `consensusVsMarket`, the gap between a sector's bullish-versus-bearish
   * mention balance and the market's. Available on every tier with the same response; each
   * call counts against the monthly quota. It is a daily precomputed snapshot, so `generatedAt`
   * (epoch seconds) is its freshness.
   *
   * @example
   * const { sectors } = await client.marketMood.getSentimentSectors();
   * for (const s of sectors) console.log(s.sector, s.consensusVsMarket, s.consensusLabel);
   */
  async getSentimentSectors(): Promise<SentimentSectors> {
    return this.client.get("/api/v1/sentiment/sectors");
  }

  /**
   * Get market-wide sentiment breadth: each day's share of the covered US stocks leaning
   * bullish, neutral or bearish, the tone analogue of an advance/decline line.
   *
   * `series` runs oldest to newest, and `latest` is the newest entry of `series`. Available on
   * every tier with the same response; each call counts against the monthly quota. It is a daily
   * precomputed snapshot, so `generatedAt` (epoch seconds) is its freshness.
   *
   * @example
   * const breadth = await client.marketMood.getSentimentBreadth();
   * console.log(breadth.latest?.date, breadth.latest?.netBreadth);
   */
  async getSentimentBreadth(): Promise<SentimentBreadth> {
    return this.client.get("/api/v1/sentiment/breadth");
  }
}
