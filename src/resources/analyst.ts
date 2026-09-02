import type { APIClient } from "../client.js";
import type { PreviewResponse } from "../types.js";

export interface AnalystConsensus {
  ticker: string;
  currentPrice: number | null;
  targetLow: number | null;
  targetMean: number | null;
  targetHigh: number | null;
  targetMedian: number | null;
  numberOfAnalysts: number;
  upsidePercent: number | null;
  consensusLabel: string | null;
  recommendationMean: number | null;
  /** PRO-only; zero in the free preview. */
  strongBuy: number;
  /** PRO-only; zero in the free preview. */
  buy: number;
  /** PRO-only; zero in the free preview. */
  hold: number;
  /** PRO-only; zero in the free preview. */
  sell: number;
  /** PRO-only; zero in the free preview. */
  strongSell: number;
  updatedAt: string | null;
}

export interface AnalystAction {
  ticker: string;
  actionDate: string;
  firm: string;
  /** UPGRADE, DOWNGRADE, INITIATE, REITERATE, OTHER */
  actionType: string;
  fromGrade: string | null;
  toGrade: string | null;
}

export interface AnalystEstimate {
  /** Fiscal period descriptor (provider-specific shape). */
  [key: string]: unknown;
}

export interface AnalystEarningsSurprise {
  /** Past report descriptor (provider-specific shape). */
  [key: string]: unknown;
}

export interface AnalystEstimatesResponse {
  estimates: AnalystEstimate[];
  surprises: AnalystEarningsSurprise[];
}

export interface GetAnalystActionsOptions {
  /** Days of history to return. Default 90. */
  lookbackDays?: number;
}

export interface GetAnalystMarketActivityOptions {
  /** Days of history to return. Default 30. */
  lookbackDays?: number;
}

/** One price target note. */
export interface AnalystNote {
  /** ISO date the note was published, `"YYYY-MM-DD"`. */
  publishedDate: string;
  /**
   * The individual named on the note, or `null` when the report named nobody.
   * Absent means the report did not identify one, never that the note did not happen.
   */
  analyst: string | null;
  priceTarget: number | null;
  adjPriceTarget: number | null;
  priceWhenPosted: number | null;
  newsTitle: string | null;
  newsUrl: string | null;
  newsPublisher: string | null;
}

/** A firm's most recent rating action. Published at firm level, with no individual attached. */
export interface AnalystFirmRating {
  rating: string | null;
  priorRating: string | null;
  /** UPGRADE, DOWNGRADE, INITIATE, REITERATE, OTHER */
  actionType: string | null;
  /** ISO date of the action, `"YYYY-MM-DD"`. */
  date: string | null;
}

/** A named analyst on a firm's desk, as it appears on a coverage row. */
export interface AnalystCoverageAnalyst {
  /**
   * Addresses `analyst.profile(slug)` and `analyst.calls(slug)`. `null` for a named
   * analyst we hold no profile for; the row keeps the `name` rather than being dropped.
   */
  slug: string | null;
  name: string;
  noteCount: number;
  firstNote: string | null;
  lastNote: string | null;
  latestPriceTarget: number | null;
}

/** One firm covering the ticker. */
export interface AnalystCoverageFirm {
  firm: string;
  /** Individuals we can name on this desk. Possibly empty: not every note names one. */
  analysts: AnalystCoverageAnalyst[];
  /** This firm's price target notes in the window. `0` on a rating-only firm. */
  noteCount: number;
  attributedNoteCount: number;
  unattributedNoteCount: number;
  /** ISO dates bounding this firm's notes. `null` on a rating-only firm. */
  firstNote: string | null;
  lastNote: string | null;
  /** The firm's most recent note. `null` on a rating-only firm, so read `noteCount` first. */
  latestNote: AnalystNote | null;
  firmRating: AnalystFirmRating | null;
}

export interface AnalystCoverage {
  ticker: string;
  /** Window actually applied after clamping, in days. */
  windowDays: number;
  /** ISO date the response was built. */
  asOf: string;
  /** Firms with at least one note **or** one rating action in the window. */
  firmCount: number;
  /**
   * How many of `firmCount` appear on a rating action alone. Firms that published a
   * target are `firmCount - ratingOnlyFirmCount`.
   */
  ratingOnlyFirmCount: number;
  namedAnalystCount: number;
  noteCount: number;
  /** Notes that name an individual. */
  attributedNoteCount: number;
  /** Notes that name no individual. */
  unattributedNoteCount: number;
  /** Plain-language statement of what an absent name means. */
  attributionNote: string;
  /** Firm rows, most recently active first. PRO: all. FREE: 5. */
  coverage: AnalystCoverageFirm[];
}

/** One firm an analyst has published under. */
export interface AnalystFirmTenure {
  firm: string;
  /** ISO date of the earliest note we hold from this analyst at this firm. */
  firstSeen: string;
  /** ISO date of the most recent one. */
  lastSeen: string;
  mostRecent: boolean;
}

/** One ticker in an analyst's coverage book. */
export interface AnalystCoverageBookEntry {
  ticker: string;
  noteCount: number;
  firstNote: string | null;
  lastNote: string | null;
  latestPriceTarget: number | null;
  latestFirm: string | null;
}

export interface AnalystProfile {
  slug: string;
  name: string;
  /** `"sell_side_equity"` */
  role: string;
  /** Where this analyst last published, which is not necessarily where they work today. */
  mostRecentFirm: string | null;
  firms: AnalystFirmTenure[];
  firstSeen: string | null;
  lastSeen: string | null;
  /** Price target notes attributed to this analyst. */
  noteCount: number;
  /** Distinct tickers covered. */
  tickerCount: number;
  /** PRO: the full book. FREE: the 5 most recently covered tickers. */
  coverage: AnalystCoverageBookEntry[];
}

/** One row of an analyst's call history. */
export interface AnalystCall {
  /** ISO date the note was published, `"YYYY-MM-DD"`. Day granularity on purpose. */
  publishedDate: string;
  ticker: string;
  /** The firm this analyst published under at the time. */
  firm: string;
  priceTarget: number | null;
  adjPriceTarget: number | null;
  priceWhenPosted: number | null;
  newsTitle: string | null;
  newsUrl: string | null;
  newsPublisher: string | null;
}

export interface GetAnalystCoverageOptions {
  /**
   * Coverage window in days, 1 to 1825. Omitted, the API applies its own default of
   * 365. Values above the cap are clamped rather than rejected, and `data.windowDays`
   * reports the window actually applied.
   */
  lookbackDays?: number;
}

export interface GetAnalystCallsOptions {
  /** Page size, 1 to 200. Omitted, the API applies its own default of 25. */
  limit?: number;
  /** Rows to skip. Omitted, the API starts at 0. */
  offset?: number;
}

/**
 * Wall Street analyst coverage: aggregate price targets, recommendation distribution,
 * recent upgrade/downgrade actions, and forward EPS estimates with earnings surprise history.
 *
 * Free users receive the price target band (low/mean/high + analyst count + consensus label)
 * in full -- it powers the public projection cone. The buy/hold/sell distribution counts
 * and full action/estimate history are PRO-only.
 */
export class Analyst {
  constructor(private client: APIClient) {}

  /**
   * Get the aggregate Wall Street consensus for a ticker. Returns 404 if no
   * coverage exists.
   */
  async consensus(
    ticker: string,
  ): Promise<PreviewResponse<AnalystConsensus>> {
    return this.client.get(
      `/api/v1/analyst/${encodeURIComponent(ticker.toUpperCase())}/consensus`,
    );
  }

  /**
   * Get recent analyst upgrade/downgrade actions for a ticker, newest first.
   * Free users receive the 3 most recent.
   */
  async actions(
    ticker: string,
    options?: GetAnalystActionsOptions,
  ): Promise<PreviewResponse<AnalystAction[]>> {
    return this.client.get(
      `/api/v1/analyst/${encodeURIComponent(ticker.toUpperCase())}/actions`,
      options,
    );
  }

  /**
   * Get forward EPS estimates and earnings surprise history for a ticker.
   * Free users receive 1 estimate (current quarter) plus the 2 most recent surprises.
   */
  async estimates(
    ticker: string,
  ): Promise<PreviewResponse<AnalystEstimatesResponse>> {
    return this.client.get(
      `/api/v1/analyst/${encodeURIComponent(ticker.toUpperCase())}/estimates`,
    );
  }

  /**
   * Get market-wide recent analyst actions across all covered tickers, newest first.
   * Free users receive the 5 most recent.
   */
  async marketActivity(
    options?: GetAnalystMarketActivityOptions,
  ): Promise<PreviewResponse<AnalystAction[]>> {
    return this.client.get("/api/v1/analyst/activity", options);
  }

  /**
   * Get who covers a ticker and what they most recently said, grouped by firm, most
   * recently active firm first.
   *
   * This is the one-call answer to "who covers AMD and what do they say". Each row in
   * `data.coverage` is a firm, the individual analysts we can name on that firm's desk,
   * that firm's most recent price target note, and that firm's most recent rating action.
   *
   * A PRO key receives every firm. A FREE key receives the 5 most recently active firms
   * with every response-level count intact, so the counts describe the full window even
   * when the rows do not.
   *
   * Two shapes to read rather than assume. **A firm can cover a stock without publishing
   * a price target**, because coverage means a note or a rating action in the window: that
   * row carries `noteCount: 0`, a `null` `latestNote` and a populated `firmRating`, so
   * read `noteCount` on the row instead of expecting a note. And **not every note names
   * its analyst**, at a rate that is a property of the publisher and varies enormously by
   * ticker, so a firm can appear with an empty `analysts` array and a non-zero
   * `noteCount`, and `latestNote.analyst` can be `null`. Read `attributedNoteCount` and
   * `unattributedNoteCount` off the response you received rather than hardcoding a rate.
   *
   * `firmRating` belongs to the firm, not to a person: rating actions are published at
   * firm level with no individual attached.
   *
   * Each named analyst carries the `slug` that addresses {@link profile} and
   * {@link calls}, so a coverage response is the natural entry point into a person.
   */
  async coverage(
    ticker: string,
    options?: GetAnalystCoverageOptions,
  ): Promise<PreviewResponse<AnalystCoverage>> {
    return this.client.get(
      `/api/v1/analyst/${encodeURIComponent(ticker.toUpperCase())}/coverage`,
      options,
    );
  }

  /**
   * Get one analyst: the firms they have published under, the window of notes we hold at
   * each, and the tickers they cover. Throws `NotFoundError` when the slug matches no
   * analyst.
   *
   * A PRO key receives the full book. A FREE key receives the profile with
   * `data.coverage` truncated to the 5 most recently covered tickers, and the envelope's
   * `totalCount` reporting how many there are in full.
   *
   * `firstSeen` and `lastSeen` are observation windows, not employment dates: they bound
   * the notes we hold from that analyst at that firm. `mostRecentFirm` says where they
   * last published, not where they work today. Do not render either as a hire or
   * departure date.
   *
   * This is call history, not a scorecard. There is no accuracy score, hit rate or
   * ranking here, and nothing in the response should be read as a rating of the person.
   *
   * @param slug Analyst slug, lowercased and hyphenated (e.g. `"dan-ives"`). You do not
   *   have to guess one: every named analyst in a {@link coverage} response carries it.
   */
  async profile(slug: string): Promise<PreviewResponse<AnalystProfile>> {
    return this.client.get(
      `/api/v1/analyst/people/${encodeURIComponent(slug)}`,
    );
  }

  /**
   * Get one analyst's price target notes, newest first, paged. Throws `NotFoundError`
   * when the slug matches no analyst, which keeps "this analyst has published nothing we
   * hold" (an empty page) distinguishable from "this analyst does not exist".
   *
   * Ordered by published date descending with the row id as the final tie-break, a total
   * order, so walking the history with `offset` never drops or repeats a row. That
   * matters more than it looks: a single roundup article carries several of one analyst's
   * notes at an identical timestamp.
   *
   * A FREE key receives the first 25 rows as a complete response (`isPreview: false`);
   * asking for a larger `limit` or an `offset` past row 25 returns the free in-allowance
   * slice with `previewReason: "PRO_REQUIRED"`. A PRO key pages the whole history. The
   * envelope's `totalCount` is the analyst's whole attributed history rather than the page
   * size, so `offset + data.length < totalCount` tells you another page is available.
   *
   * Dates are day granularity on purpose. Publisher timestamps are not comparable across
   * sources, so a time of day would advertise precision the data does not have.
   */
  async calls(
    slug: string,
    options?: GetAnalystCallsOptions,
  ): Promise<PreviewResponse<AnalystCall[]>> {
    return this.client.get(
      `/api/v1/analyst/people/${encodeURIComponent(slug)}/calls`,
      options,
    );
  }
}
