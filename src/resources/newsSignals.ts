import type { APIClient } from "../client.js";
import { pathSegment } from "../pathSegment.js";
import type {
  NewsSignalsOptions,
  EventCounts,
  HeadlineScores,
  PreviewResponse,
} from "../types.js";

/** The window query of the news signals methods: only the keys the caller set. */
function newsWindow(options: NewsSignalsOptions): Record<string, string | number> {
  const { days, from, to } = options;
  return {
    ...(days !== undefined && { days }),
    ...(from !== undefined && { from }),
    ...(to !== undefined && { to }),
  };
}

/**
 * News signals: daily counts of what our models read in news headlines, per stock or entity and
 * market-wide. Event counts say what the headlines were about; headline scores say how they were
 * worded. See https://sentisense.ai/docs/api/news-signals/
 */
export class NewsSignals {
  constructor(private client: APIClient) {}

  /**
   * Get daily news event counts for a stock or entity.
   *
   * Per closed US Eastern day: the news headlines tagged to the entity, how many our events model
   * classified, how many report no event, and how many fall in each category (results, product
   * news, analyst actions, deals, legal, people, macro). `data.categories` lists each category
   * with the story event types it groups. These are daily counts: no single headline's event type
   * is returned. Today is never served, and a day not counted yet is absent (`data.asOf` is the
   * newest day served).
   *
   * A PRO key receives the window asked for. A free key receives the last 7 closed days whatever
   * it asks for, with `isPreview: true`. Each call counts against the monthly quota.
   *
   * @param symbol  Ticker symbol (e.g. "AAPL") or entity urlSlug.
   * @param options `days` (1 to 90, default 30), or `from` and `to` as `"YYYY-MM-DD"`.
   * @throws {SentiSenseError} Before any request, when `symbol` is empty, whitespace only, `"."`
   *         or `".."`.
   */
  async getEventCounts(
    symbol: string,
    options: NewsSignalsOptions = {},
  ): Promise<PreviewResponse<EventCounts>> {
    return this.client.get(
      `/api/v2/metrics/entity/${pathSegment("newsSignals.getEventCounts", "symbol", symbol)}/event-counts`,
      newsWindow(options),
    );
  }

  /**
   * Get daily news event counts for the whole market: every news headline of the day, each
   * counted once, with `data.entity` set to `"market"`. Same window options, response and free
   * preview as `getEventCounts()`.
   *
   * @param options `days` (1 to 90, default 30), or `from` and `to` as `"YYYY-MM-DD"`.
   */
  async getMarketEventCounts(options: NewsSignalsOptions = {}): Promise<PreviewResponse<EventCounts>> {
    return this.client.get("/api/v2/metrics/market/event-counts", newsWindow(options));
  }

  /**
   * Get daily headline score counts for a stock or entity.
   *
   * Per closed US Eastern day: how many of the entity's news headlines our decision models scored,
   * how many scored strongly on each score (`UNCERTAINTY`, `PROMOTION`, `RESOLUTION`), and the
   * count at each level. `data.scores` defines each score: `strongFrom` on the 0 to 100 scale and
   * its levels. These are daily counts, not the SentiSense Score, and no single headline's score is
   * returned. `strongHeadlines` counts a headline once however many scores were strong on it.
   *
   * A PRO key receives the window asked for. A free key receives the last 7 closed days whatever
   * it asks for, with `isPreview: true`. Each call counts against the monthly quota.
   *
   * @param symbol  Ticker symbol (e.g. "AAPL") or entity urlSlug.
   * @param options `days` (1 to 90, default 30), or `from` and `to` as `"YYYY-MM-DD"`.
   * @throws {SentiSenseError} Before any request, when `symbol` is empty, whitespace only, `"."`
   *         or `".."`.
   */
  async getHeadlineScores(
    symbol: string,
    options: NewsSignalsOptions = {},
  ): Promise<PreviewResponse<HeadlineScores>> {
    return this.client.get(
      `/api/v2/metrics/entity/${pathSegment("newsSignals.getHeadlineScores", "symbol", symbol)}/headline-scores`,
      newsWindow(options),
    );
  }

  /**
   * Get daily headline score counts for the whole market: every news headline of the day, each
   * counted once, with `data.entity` set to `"market"`. Same window options, response and free
   * preview as `getHeadlineScores()`.
   *
   * @param options `days` (1 to 90, default 30), or `from` and `to` as `"YYYY-MM-DD"`.
   */
  async getMarketHeadlineScores(
    options: NewsSignalsOptions = {},
  ): Promise<PreviewResponse<HeadlineScores>> {
    return this.client.get("/api/v2/metrics/market/headline-scores", newsWindow(options));
  }
}
