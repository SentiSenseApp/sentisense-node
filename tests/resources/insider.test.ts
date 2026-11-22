import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense from "../../src/index.js";
import type { GetInsiderTradesOptions } from "../../src/index.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const client = new SentiSense({ apiKey: "ssk_test" });
const BASE = "https://app.sentisense.ai/api/v1/insider/trades";
const empty = { isPreview: false, previewReason: null, data: [] };

describe("insider.getTrades limit", () => {
  // Adding `limit` must not change the request an existing caller makes, so these assert
  // the whole URL rather than the absence of individual params.
  it("sends the original request when called without options", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(empty));
    await client.insider.getTrades("NVDA");
    expect(mockFetch.mock.calls[0][0]).toBe(`${BASE}/NVDA`);
  });

  it("sends the original request with lookbackDays alone", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(empty));
    await client.insider.getTrades("NVDA", { lookbackDays: 30 });
    expect(mockFetch.mock.calls[0][0]).toBe(`${BASE}/NVDA?lookbackDays=30`);
  });

  it("leaves limit off when it is undefined", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(empty));
    await client.insider.getTrades("NVDA", { lookbackDays: 30, limit: undefined });
    expect(mockFetch.mock.calls[0][0]).toBe(`${BASE}/NVDA?lookbackDays=30`);
  });

  it("sends limit when given", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(empty));
    await client.insider.getTrades("brk.b", { lookbackDays: 365, limit: 10 });
    expect(mockFetch.mock.calls[0][0]).toBe(`${BASE}/BRK.B?lookbackDays=365&limit=10`);
  });

  it("sends limit without lookbackDays", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(empty));
    await client.insider.getTrades("NVDA", { limit: 1 });
    expect(mockFetch.mock.calls[0][0]).toBe(`${BASE}/NVDA?limit=1`);
  });

  it("forwards out-of-range values for the server to answer", async () => {
    // The server rejects values below 1 and caps values above 1000; the SDK forwards
    // what it was given rather than guessing at either rule.
    for (const limit of [0, 5000]) {
      mockFetch.mockResolvedValueOnce(jsonResponse(empty));
      await client.insider.getTrades("NVDA", { limit });
      const calls = mockFetch.mock.calls;
      expect(calls[calls.length - 1][0]).toBe(`${BASE}/NVDA?limit=${limit}`);
    }
  });

  it("reads totalCount for the whole window through the envelope", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: false,
        previewReason: null,
        totalCount: 137,
        data: [
          { ticker: "NVDA", transactionCode: "S", insiderName: "Jane Doe" },
          { ticker: "NVDA", transactionCode: "P", insiderName: "John Roe" },
        ],
      }),
    );
    const options: GetInsiderTradesOptions = { limit: 2 };
    const result = await client.insider.getTrades("NVDA", options);
    expect(result.totalCount).toBe(137);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].ticker).toBe("NVDA");
  });

  it("keeps limit off the other insider methods' options", () => {
    // getActivity and getClusterBuys take GetInsiderOptions, which has no limit.
    // @ts-expect-error limit belongs to getTrades only
    const activityOptions: Parameters<typeof client.insider.getActivity>[0] = { limit: 5 };
    // @ts-expect-error limit belongs to getTrades only
    const clusterOptions: Parameters<typeof client.insider.getClusterBuys>[0] = { limit: 5 };
    expect(activityOptions).toBeDefined();
    expect(clusterOptions).toBeDefined();
  });
});
