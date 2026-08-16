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

  it("sends a bare URL with no query string when called with no options", async () => {
    // Adding paging options must not change the request an existing caller makes, so
    // assert the whole URL rather than the absence of individual params.
    const data = { isPreview: false, previewReason: null, data: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));
    await client.politicians.getActivity();
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://app.sentisense.ai/api/v1/politicians/activity",
    );
  });

  it("sends the same bare URL when called with an empty options object", async () => {
    const data = { isPreview: false, previewReason: null, data: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));
    await client.politicians.getActivity({});
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://app.sentisense.ai/api/v1/politicians/activity",
    );
  });

  it("passes limit and offset for paging past the default page", async () => {
    const data = { isPreview: false, previewReason: null, totalCount: 1437, data: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));
    await client.politicians.getActivity({ limit: 100, offset: 200 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("limit=100");
    expect(url).toContain("offset=200");
  });

  it("sends offset=0 as a real value rather than dropping it", async () => {
    const data = { isPreview: false, previewReason: null, data: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));
    await client.politicians.getActivity({ limit: 50, offset: 0 });
    expect(mockFetch.mock.calls[0][0] as string).toContain("offset=0");
  });

  it("combines paging with the lookback window", async () => {
    const data = { isPreview: false, previewReason: null, totalCount: 566, data: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));
    await client.politicians.getActivity({ lookbackDays: 30, limit: 2, offset: 1 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("lookbackDays=30");
    expect(url).toContain("limit=2");
    expect(url).toContain("offset=1");
  });

  it("reads totalCount off a full response, which is how a pager sizes the walk", async () => {
    // The feed is ~1437 rows and the server returns 200 by default, so data.length is
    // not the total. totalCount is present here even though isPreview is false.
    const data = {
      isPreview: false,
      previewReason: null,
      totalCount: 1437,
      data: [{ ticker: "MPC", transactionType: "SALE" }],
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));
    const result = await client.politicians.getActivity({ limit: 1 });
    expect(result.isPreview).toBe(false);
    expect(result.totalCount).toBe(1437);
    expect(result.data).toHaveLength(1);
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

  it("sends a bare URL with no query string when called with no options", async () => {
    // Adding paging options must not change the request an existing caller makes.
    const detail = {
      isPreview: false,
      previewReason: null,
      data: { profile: {}, recentTrades: [], topTickers: [] },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(detail));
    await client.politicians.getMember("nancy-pelosi");
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://app.sentisense.ai/api/v1/politicians/member/nancy-pelosi",
    );
  });

  it("passes limit and offset for paging past the default page", async () => {
    const detail = {
      isPreview: false,
      previewReason: null,
      totalCount: 12159,
      data: { profile: {}, recentTrades: [], topTickers: [] },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(detail));
    await client.politicians.getMember("Ro-Khanna", { limit: 500, offset: 500 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("limit=500");
    expect(url).toContain("offset=500");
  });

  it("sends offset=0 as a real value rather than dropping it", async () => {
    const detail = {
      isPreview: false,
      previewReason: null,
      data: { profile: {}, recentTrades: [], topTickers: [] },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(detail));
    await client.politicians.getMember("Ro-Khanna", { limit: 50, offset: 0 });
    expect(mockFetch.mock.calls[0][0] as string).toContain("offset=0");
  });

  it("reads totalCount off a full response, which is how a pager sizes the walk", async () => {
    // The longest history is ~12,159 trades and the server returns 200 by default, so
    // recentTrades.length is not the total. totalCount is present with isPreview false.
    const detail = {
      isPreview: false,
      previewReason: null,
      totalCount: 12159,
      data: {
        profile: { urlSlug: "Ro-Khanna", totalTrades: 12159 },
        recentTrades: [{ ticker: "NVDA" }],
        topTickers: [],
      },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(detail));
    const result = await client.politicians.getMember("Ro-Khanna", { limit: 200 });
    expect(result.totalCount).toBe(12159);
    expect(result.data.recentTrades.length).toBeLessThan(result.totalCount!);
  });

  it("keeps profile counters on the whole history, not the page", async () => {
    // A profile that shrinks with limit would make paging report the wrong denominator.
    const detail = {
      isPreview: false,
      previewReason: null,
      totalCount: 12159,
      data: {
        profile: { urlSlug: "Ro-Khanna", totalTrades: 12159 },
        recentTrades: [{ ticker: "NVDA" }],
        topTickers: [],
      },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(detail));
    const result = await client.politicians.getMember("Ro-Khanna", { limit: 1 });
    expect(result.data.profile.totalTrades).toBe(12159);
  });
});

describe("politicians.getDirectory", () => {
  it("calls GET /api/v1/politicians/directory and unwraps the envelope", async () => {
    const data = {
      isPreview: false,
      previewReason: null,
      data: {
        totalCount: 1,
        members: [
          {
            urlSlug: "Kelly-Loeffler",
            displayName: "Kelly Loeffler",
            chamber: "SENATE",
            party: "Republican",
            state: "GA",
            bioguideId: "L000594",
            imageUrl: null,
            former: true,
            servedUntil: "2021",
          },
        ],
      },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    const result = await client.politicians.getDirectory({ q: "loeffler" });
    const url = mockFetch.mock.calls[0][0] as string;

    expect(url).toContain("/api/v1/politicians/directory");
    expect(url).toContain("q=loeffler");
    expect(result.totalCount).toBe(1);
    expect(result.members[0].urlSlug).toBe("Kelly-Loeffler");
  });

  it("preserves the former flag, which is why this endpoint exists", async () => {
    // getMembers omits members who have left Congress, so if unwrapping dropped these
    // two fields a caller could not tell a former member from a sitting one anywhere.
    const data = {
      isPreview: false,
      previewReason: null,
      data: {
        totalCount: 1,
        members: [{ urlSlug: "Kelly-Loeffler", former: true, servedUntil: "2021" }],
      },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    const result = await client.politicians.getDirectory();

    expect(result.members[0].former).toBe(true);
    expect(result.members[0].servedUntil).toBe("2021");
  });

  it("sends a bare URL with no query string when called with no options", async () => {
    const data = { isPreview: false, previewReason: null, data: { totalCount: 0, members: [] } };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await client.politicians.getDirectory();

    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://app.sentisense.ai/api/v1/politicians/directory",
    );
  });

  it("passes limit and offset through", async () => {
    const data = { isPreview: false, previewReason: null, data: { totalCount: 0, members: [] } };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await client.politicians.getDirectory({ limit: 5, offset: 10 });
    const url = mockFetch.mock.calls[0][0] as string;

    expect(url).toContain("limit=5");
    expect(url).toContain("offset=10");
  });
});
