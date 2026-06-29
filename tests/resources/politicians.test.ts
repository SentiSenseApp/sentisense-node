import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense from "../../src/index.js";

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

describe("politicians.getActivity", () => {
  it("calls GET /api/v1/politicians/activity with lookbackDays", async () => {
    const data = { isPreview: false, previewReason: null, data: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));
    const result = await client.politicians.getActivity({ lookbackDays: 30 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/politicians/activity");
    expect(url).toContain("lookbackDays=30");
    expect(result.data).toEqual([]);
  });

  it("works without options", async () => {
    const data = { isPreview: false, previewReason: null, data: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));
    await client.politicians.getActivity();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/politicians/activity");
    expect(url).not.toContain("lookbackDays");
  });

  it("surfaces option assetMetadata on option trades", async () => {
    const data = {
      isPreview: false,
      previewReason: null,
      data: [
        {
          ticker: "NVDA",
          assetType: "Stock Option",
          assetMetadata: {
            kind: "OPTION",
            optionType: "CALL",
            strikePrice: 50,
            expirationDate: "2026-12-18",
          },
          transactionType: "PURCHASE",
        },
      ],
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));
    const result = await client.politicians.getActivity();
    const trade = result.data[0];
    expect(trade.assetType).toBe("Stock Option");
    expect(trade.assetMetadata?.kind).toBe("OPTION");
    expect(trade.assetMetadata?.optionType).toBe("CALL");
    expect(trade.assetMetadata?.strikePrice).toBe(50);
    expect(trade.assetMetadata?.expirationDate).toBe("2026-12-18");
  });

  it("leaves assetMetadata absent on plain stock trades", async () => {
    const data = {
      isPreview: false,
      previewReason: null,
      data: [{ ticker: "NVDA", assetType: "Stock", transactionType: "PURCHASE" }],
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));
    const result = await client.politicians.getActivity();
    expect(result.data[0].assetMetadata).toBeUndefined();
  });
});

describe("politicians.getFilings", () => {
  it("includes uppercased ticker in path and lookbackDays in params", async () => {
    const data = { isPreview: false, previewReason: null, data: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));
    await client.politicians.getFilings("nvda", { lookbackDays: 180 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/politicians/filings/NVDA");
    expect(url).toContain("lookbackDays=180");
  });
});

describe("politicians.getMembers", () => {
  it("calls GET /api/v1/politicians/members with no params", async () => {
    const data = { isPreview: false, previewReason: null, data: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));
    const result = await client.politicians.getMembers();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/politicians/members");
    expect(result.isPreview).toBe(false);
  });
});

describe("politicians.getMember", () => {
  it("includes slug in path", async () => {
    const detail = {
      isPreview: false,
      previewReason: null,
      data: {
        profile: { urlSlug: "nancy-pelosi", displayName: "Nancy Pelosi" },
        recentTrades: [],
        topTickers: ["NVDA"],
      },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(detail));
    const result = await client.politicians.getMember("nancy-pelosi");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/politicians/member/nancy-pelosi");
    expect(result.data.topTickers).toContain("NVDA");
  });
});
