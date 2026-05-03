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
}
