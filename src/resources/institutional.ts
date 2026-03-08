import type { APIClient } from "../client.js";
import type {
  GetFlowsOptions,
  Holder,
  InstitutionalFlowsResponse,
  Quarter,
} from "../types.js";

export class Institutional {
  constructor(private client: APIClient) {}

  /** Get available 13F reporting quarters. */
  async getQuarters(): Promise<Quarter[]> {
    return this.client.get("/api/v1/institutional/quarters");
  }

  /** Get aggregate institutional activity per ticker for a quarter. */
  async getFlows(reportDate: string, options?: GetFlowsOptions): Promise<InstitutionalFlowsResponse> {
    return this.client.get("/api/v1/institutional/flows", {
      reportDate,
      ...options,
    });
  }

  /** Get institutional holders for a specific stock. */
  async getHolders(ticker: string, reportDate: string): Promise<Holder[]> {
    return this.client.get(
      `/api/v1/institutional/holders/${encodeURIComponent(ticker)}`,
      { reportDate },
    );
  }

  /** Get activist investor positions (NEW or INCREASED). */
  async getActivists(reportDate: string): Promise<Holder[]> {
    return this.client.get("/api/v1/institutional/activist", { reportDate });
  }
}
