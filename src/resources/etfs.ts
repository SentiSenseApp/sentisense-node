import type { APIClient } from "../client.js";
import type { PreviewResponse } from "../types.js";

export interface EtfInfo {
  ticker: string;
  name: string;
  kbEntityId: string | null;
  urlSlug: string | null;
  issuer: string | null;
  trackedIndex: string | null;
  assetClass: string | null;
}

export interface EtfHolding {
  ticker: string;
  name: string | null;
  /** Weight in the fund as a percentage (0-100). */
  weightPct: number;
  /** ISO date "YYYY-MM-DD" — first date this holding appeared in the composition. */
  firstSeen: string | null;
}

export interface EtfHoldings {
  ticker: string;
  issuer: string;
  issuerEndpoint: string | null;
  /** ISO date "YYYY-MM-DD" — composition snapshot date from the issuer. */
  asOfDate: string;
  /** Epoch seconds when SentiSense refreshed the composition. */
  fetchedAt: number | null;
  /** ISO date "YYYY-MM-DD" — when the composition is scheduled to be refreshed next. */
  nextRefreshDue: string;
  totalHoldings: number;
  holdings: EtfHolding[];
  /** True when this is a top-N view rather than the full fund. */
  partial?: boolean | null;
  /** Issuer's reported total holdings when `partial=true`. */
  totalKnownHoldings?: number | null;
}

export interface EtfAggregateCoverage {
  holdingsCount: number;
  holdingsCovered: number;
  /** Sum of weights (0-100) for the covered holdings. */
  weightCovered: number;
  partial?: boolean | null;
  totalKnownHoldings?: number | null;
}

export interface WeightedConsensus {
  upsidePercent: number | null;
  consensusLabel: string | null;
  /** Fractions of covered AUM in each bucket. Sums to ~1.0. */
  distribution: Record<string, number>;
  totalAnalysts: number;
}

export interface EtfAnalystContributor {
  ticker: string;
  weightPct: number;
  upsidePercent: number | null;
  consensusLabel: string | null;
  /** Signed contribution to the fund's weighted upside in percentage points. */
  contributionPp: number;
}

export interface EtfAnalystAggregate {
  ticker: string;
  /** ISO date "YYYY-MM-DD" — composition snapshot date. */
  asOfDate: string | null;
  /** Epoch seconds when this rollup was computed. */
  computedAt: number;
  coverage: EtfAggregateCoverage;
  weightedConsensus: WeightedConsensus;
  /** Top contributors (up to 10) by absolute contribution to the weighted upside. */
  topContributors: EtfAnalystContributor[];
}

export interface WeightedNetFlow {
  /** Weighted net dollar flow (buys - sells). Negative = net selling. */
  netDollars: number;
  buyDollars: number;
  sellDollars: number;
  /** Unweighted; for context. */
  buyTradeCount: number;
  /** Unweighted; for context. */
  sellTradeCount: number;
  distinctInsiderCount: number;
}

export interface EtfInsiderContributor {
  ticker: string;
  weightPct: number;
  /** Per-stock net flow over the window (signed). */
  netDollars: number;
  /** Signed contribution to the weighted headline. */
  weightedNetDollars: number;
  tradeCount: number;
}

export interface EtfInsiderAggregate {
  ticker: string;
  /** ISO date "YYYY-MM-DD" — composition snapshot date. */
  asOfDate: string | null;
  /** Epoch seconds when this rollup was computed. */
  computedAt: number;
  lookbackDays: number;
  coverage: EtfAggregateCoverage;
  weightedNetFlow: WeightedNetFlow;
  /** Top contributors (up to 10) by absolute weighted-net-dollar contribution. */
  topContributors: EtfInsiderContributor[];
}

export interface EtfSentimentReading {
  sentiSenseScore: number | null;
  /** BULLISH / NEUTRAL / BEARISH. */
  scoreLabel: string;
  /** Epoch seconds when the underlying metric was produced. */
  asOfTimestamp: number | null;
}

export interface EtfSentimentAggregate {
  ticker: string;
  /** ISO date "YYYY-MM-DD" — composition snapshot date. */
  asOfDate: string | null;
  /** Epoch seconds when this aggregate was assembled. */
  computedAt: number;
  coverage: EtfAggregateCoverage;
  /** Holdings-weighted SentiSense across the fund's constituents. */
  constituentsWeighted: EtfSentimentReading;
  /** Direct reading from mentions of the fund's own ticker. Null for low-mention funds. */
  direct: EtfSentimentReading | null;
}

export interface GetEtfInsiderAggregateOptions {
  /** Trailing window for the trade aggregation. Typical values: 30, 90. Default 30. */
  lookbackDays?: number;
}

/**
 * ETF discovery, composition (holdings), and holdings-weighted aggregate views.
 *
 * Funds aren't rated by analysts directly, don't have insiders of their own, and
 * may not get many direct news mentions -- but the companies inside them do. The
 * aggregate endpoints synthesize fund-level views from each constituent's per-stock
 * data, weighted by allocation, with a coverage block so consumers see how much of
 * the fund's AUM the underlying data covered.
 *
 * Beta as of 2026-05-15: starting with a limited set of widely-traded funds.
 */
export class Etfs {
  constructor(private client: APIClient) {}

  /**
   * List every ETF tracked by SentiSense, sorted by ticker.
   */
  async list(): Promise<EtfInfo[]> {
    return this.client.get("/api/v1/etfs");
  }

  /**
   * Get the full holdings composition for an ETF, including per-holding weights
   * and freshness metadata. Returns 404 for unknown ETFs or commodity-only funds.
   */
  async holdings(ticker: string): Promise<EtfHoldings> {
    return this.client.get(
      `/api/v1/etfs/${encodeURIComponent(ticker.toUpperCase())}/holdings`,
    );
  }

  /**
   * Get the holdings-weighted analyst consensus for an ETF, including the
   * top per-holding contributors that drive the weighted upside.
   */
  async analystAggregate(
    ticker: string,
  ): Promise<PreviewResponse<EtfAnalystAggregate>> {
    return this.client.get(
      `/api/v1/etfs/${encodeURIComponent(ticker.toUpperCase())}/aggregates/analyst`,
    );
  }

  /**
   * Get the holdings-weighted SEC Form 4 insider aggregate for an ETF over a
   * configurable trailing window, including per-holding `topContributors` with
   * signed contribution to the weighted headline.
   */
  async insiderAggregate(
    ticker: string,
    options?: GetEtfInsiderAggregateOptions,
  ): Promise<PreviewResponse<EtfInsiderAggregate>> {
    return this.client.get(
      `/api/v1/etfs/${encodeURIComponent(ticker.toUpperCase())}/aggregates/insider`,
      options,
    );
  }

  /**
   * Get two SentiSense Score readings side-by-side: `constituentsWeighted`
   * (precomputed daily weighted average across the fund's holdings) and `direct`
   * (score from mentions of the fund's own ticker). The two can diverge, and the
   * gap is itself information.
   */
  async sentimentAggregate(
    ticker: string,
  ): Promise<PreviewResponse<EtfSentimentAggregate>> {
    return this.client.get(
      `/api/v1/etfs/${encodeURIComponent(ticker.toUpperCase())}/aggregates/sentiment`,
    );
  }
}
