import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense from "../../src/index.js";

const mockFetch = vi.fn();
const client = new SentiSense({ apiKey: "ssk_test" });

beforeEach(() => vi.stubGlobal("fetch", mockFetch));
afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

function respond(payload: unknown) {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function requestedUrl(): URL {
  return new URL(String(mockFetch.mock.calls[0][0]));
}

const DISTRIBUTION = {
  metricType: "mentions",
  dimension: "source",
  distribution: { News: 92.69, Reddit: 7.31 },
  valueType: "SHARE_PERCENT",
};

describe("entityMetrics.getDistribution", () => {
  it("forwards a time window in epoch milliseconds", async () => {
    respond(DISTRIBUTION);
    const result = await client.entityMetrics.getDistribution("AAPL", "mentions", {
      startTime: 1762000000000,
      endTime: 1762600000000,
    });
    const url = requestedUrl();
    expect(url.pathname).toBe("/api/v2/metrics/entity/AAPL/distribution/mentions");
    expect(url.searchParams.get("dimension")).toBe("source");
    expect(url.searchParams.get("startTime")).toBe("1762000000000");
    expect(url.searchParams.get("endTime")).toBe("1762600000000");
    expect(result).toEqual(DISTRIBUTION);
  });

  it("sends only the dimension when no window is given, as before", async () => {
    respond(DISTRIBUTION);
    await client.entityMetrics.getDistribution("AAPL", "sentiment");
    const url = requestedUrl();
    expect([...url.searchParams.keys()]).toEqual(["dimension"]);
    expect(url.searchParams.get("dimension")).toBe("source");
  });

  it("forwards one end of the window alone and keeps a custom dimension", async () => {
    respond(DISTRIBUTION);
    await client.entityMetrics.getDistribution("Nancy-Pelosi", "mentions", {
      dimension: "publisher",
      startTime: 1762000000000,
    });
    const url = requestedUrl();
    expect(url.searchParams.get("dimension")).toBe("publisher");
    expect(url.searchParams.get("startTime")).toBe("1762000000000");
    expect(url.searchParams.has("endTime")).toBe(false);
  });
});
