import type { APIClient } from "../client.js";
import type {
  EarningsCalendarResponse,
  GetEarningsCalendarOptions,
  PreviewResponse,
} from "../types.js";

export class Calendar {
  constructor(private client: APIClient) {}

  /**
   * Upcoming company earnings, sorted by date.
   *
   * Key-required. A FREE key returns the current week (`isPreview: true`); a PRO
   * key returns the full forward window (about 30 days). Field richness is
   * identical across tiers: the gate is how far ahead you can see, not which
   * columns you get. On a preview, `totalCount` is the full-window event count.
   */
  async getEarnings(
    options?: GetEarningsCalendarOptions,
  ): Promise<PreviewResponse<EarningsCalendarResponse>> {
    return this.client.get("/api/v1/calendar/earnings", options);
  }
}
