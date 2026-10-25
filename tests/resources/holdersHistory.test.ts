import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense, {
  type HoldersHistory,
  type HoldersHistoryQuarter,
  type PreviewResponse,
} from "../../src/index.js";

/**
 * Ownership history for one stock, quarter by quarter.
 *
 * The fixture is a live free-key response: the newest quarter still filing, three settled.
 * Three contracts are gated because each fails quietly: the newest row can be a partial,
 * still-filing quarter; the optional ratio and price fields are omitted rather than zeroed;
 * and a free key sees the newest four quarters with `totalCount` naming the full window.
 */

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

const FREE_PREVIEW = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../fixtures/holders_history_live.json", import.meta.url)),
    "utf8",
  ),
) as PreviewResponse<HoldersHistory>;

/** Every declared key, checked against the interface by `satisfies`. */
const QUARTER_KEYS = {
  reportDate: true,
  value: true,
  label: true,
  status: true,
  pending: true,
  holderCount: true,
  totalInstitutionalShares: true,
  totalInstitutionalValue: true,
  sharesOutstanding: true,
  institutionalOwnershipPct: true,
  netSharesChange: true,
  totalSharesBought: true,
  totalSharesSold: true,
  newPositions: true,
  increasedPositions: true,
  decreasedPositions: true,
  soldOutPositions: true,
  avgClosePrice: true,
  dollarFlowUsd: true,
} satisfies Record<keyof HoldersHistoryQuarter, true>;

/** Real rows with the optional fields omitted by the server. */
const ADR_ROW: HoldersHistoryQuarter = {
  reportDate: "2026-06-30",
  value: "2026Q2",
  label: "Q2 2026",
  status: "settled",
  pending: false,
  holderCount: 3546,
  totalInstitutionalShares: 761442577,
  totalInstitutionalValue: 360916323290,
  netSharesChange: -1535802,
  totalSharesBought: 62482363,
  totalSharesSold: 64018165,
  newPositions: 469,
  increasedPositions: 1432,
  decreasedPositions: 1288,
  soldOutPositions: 2,
  avgClosePrice: 405.7901612903225,
  dollarFlowUsd: -623213341.2899998,
};

const UNPRICED_ROW: HoldersHistoryQuarter = {
  reportDate: "2026-06-30",
  value: "2026Q2",
  label: "Q2 2026",
  status: "settled",
  pending: false,
  holderCount: 4895,
  totalInstitutionalShares: 914790286,
  totalInstitutionalValue: 457136783995,
  sharesOutstanding: 1408035161,
  institutionalOwnershipPct: 64.97,
  netSharesChange: 15598823,
  totalSharesBought: 44629268,
  totalSharesSold: 29030445,
  newPositions: 255,
  increasedPositions: 1987,
  decreasedPositions: 1983,
  soldOutPositions: 2,
};

const client = new SentiSense({ apiKey: "ssk_test" });

describe("institutional.getHoldersHistory", () => {
  it("calls the history path with no params by default", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(FREE_PREVIEW));
    await client.institutional.getHoldersHistory("CRM");
    const url = new URL(mockFetch.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/api/v1/institutional/holders/CRM/history");
    expect(url.search).toBe("");
  });

  it("sends quarters when given", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(FREE_PREVIEW));
    await client.institutional.getHoldersHistory("CRM", { quarters: 20 });
    const url = new URL(mockFetch.mock.calls[0][0] as string);
    expect(url.searchParams.get("quarters")).toBe("20");
  });

  it("encodes a dotted share-class ticker into the path", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, data: { ticker: "BRK.B", quarters: [] } }),
    );
    await client.institutional.getHoldersHistory("BRK.B");
    const url = new URL(mockFetch.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/api/v1/institutional/holders/BRK.B/history");
  });

  it("returns the free preview envelope with the rows under data.quarters", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(FREE_PREVIEW));
    const result = await client.institutional.getHoldersHistory("CRM");

    expect(result.isPreview).toBe(true);
    expect(result.previewReason).toBe("PRO_REQUIRED");
    expect(result.totalCount).toBe(12);
    expect(result.upgrade?.plan).toBe("PRO");
    expect(result.data.ticker).toBe("CRM");
    expect(result.data.quarters).toHaveLength(4);
  });

  it("is newest first and labels the still-filing quarter", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(FREE_PREVIEW));
    const { data } = await client.institutional.getHoldersHistory("CRM");

    const dates = data.quarters.map((q) => q.reportDate);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(data.quarters[0].status).toBe("filing");
    expect(data.quarters[0].pending).toBe(true);
    const settled = data.quarters.find((q) => q.status === "settled");
    expect(settled?.pending).toBe(false);
    expect([settled?.value, settled?.label]).toEqual(["2026Q2", "Q2 2026"]);
  });

  it("declares every key the wire sends", async () => {
    for (const row of FREE_PREVIEW.data.quarters) {
      const undeclared = Object.keys(row).filter((k) => !(k in QUARTER_KEYS));
      expect(undeclared).toEqual([]);
    }
  });

  it("keeps the flow arithmetic the docs describe on the live rows", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(FREE_PREVIEW));
    const { data } = await client.institutional.getHoldersHistory("CRM");
    for (const q of data.quarters) {
      expect(q.netSharesChange).toBe(q.totalSharesBought - q.totalSharesSold);
      expect(q.dollarFlowUsd).toBeCloseTo(q.netSharesChange * (q.avgClosePrice ?? NaN), 0);
      expect(q.institutionalOwnershipPct).toBeCloseTo(
        (100 * q.totalInstitutionalShares) / (q.sharesOutstanding ?? NaN),
        2,
      );
    }
  });

  it("leaves an absent share count and ownership percent undefined, never zero", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, data: { ticker: "TSM", quarters: [ADR_ROW] } }),
    );
    const { data } = await client.institutional.getHoldersHistory("TSM");
    expect(data.quarters[0].sharesOutstanding).toBeUndefined();
    expect(data.quarters[0].institutionalOwnershipPct).toBeUndefined();
    expect(data.quarters[0].dollarFlowUsd).toBeCloseTo(-623213341.29, 2);
  });

  it("leaves an absent price and dollar flow undefined, never zero", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, data: { ticker: "BRK.B", quarters: [UNPRICED_ROW] } }),
    );
    const result = await client.institutional.getHoldersHistory("BRK.B");
    expect(result.data.ticker).toBe("BRK.B");
    expect(result.data.quarters[0].avgClosePrice).toBeUndefined();
    expect(result.data.quarters[0].dollarFlowUsd).toBeUndefined();
    expect(result.data.quarters[0].institutionalOwnershipPct).toBe(64.97);
  });

  it("has no totalCount on a full response, and an empty list for an uncovered ticker", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ isPreview: false, previewReason: null, data: { ticker: "ZZZZ", quarters: [] } }),
    );
    const result = await client.institutional.getHoldersHistory("ZZZZ");
    expect(result.isPreview).toBe(false);
    expect(result.totalCount).toBeUndefined();
    expect(result.upgrade).toBeUndefined();
    expect(result.data.quarters).toEqual([]);
  });
});
