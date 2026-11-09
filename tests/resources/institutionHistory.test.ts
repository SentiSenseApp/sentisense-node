import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import SentiSense, {
  type InstitutionDetail,
  type InstitutionHistory,
  type InstitutionHistoryQuarter,
  type InstitutionHolding,
  type InstitutionMatchTotals,
  type PreviewResponse,
} from "../../src/index.js";

/**
 * Institution history and the institution detail paging options.
 *
 * Gated because each fails quietly: the comparison fields are omitted (not zeroed) on a
 * filing with nothing to compare against, the history `tickers` list must reach the wire
 * comma-joined, and every new detail field is optional so older responses keep parsing.
 */

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
  mockFetch.mockReset();
});

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const client = new SentiSense({ apiKey: "ssk_test" });

function lastUrl(): URL {
  return new URL(mockFetch.mock.calls[0][0] as string);
}

const AVAILABLE_ROW: InstitutionHistoryQuarter = {
  reportDate: "2026-06-30",
  value: "2026Q2",
  label: "Q2 2026",
  status: "settled",
  comparisonStatus: "AVAILABLE",
  comparisonReportDate: "2026-03-31",
  totalValueUsd: 72000000000,
  positionsHeld: 3100,
  top10Pct: 12.0,
  newPositions: 550,
  increasedPositions: 1080,
  decreasedPositions: 1500,
  soldOutPositions: 620,
  boughtUsd: 22000000000,
  trimmedUsd: 18000000000,
  exitedUsd: 5500000000,
  netFlowUsd: -1500000000,
  priceEffectUsd: 9600000000,
};

// The oldest filing has nothing to compare with, so the flow fields are omitted.
const NO_COMPARISON_ROW: InstitutionHistoryQuarter = {
  reportDate: "2025-06-30",
  value: "2025Q2",
  label: "Q2 2025",
  status: "settled",
  comparisonStatus: "PRIOR_QUARTER_UNAVAILABLE",
  totalValueUsd: 60000000000,
  positionsHeld: 2900,
  top10Pct: 11.5,
};

const HISTORY: PreviewResponse<InstitutionHistory> = {
  isPreview: false,
  previewReason: null,
  data: {
    filerCik: "0001037389",
    urlSlug: "Renaissance-Technologies",
    displayName: "Renaissance Technologies",
    quarters: [AVAILABLE_ROW, NO_COMPARISON_ROW],
    positions: {
      NVDA: [
        { reportDate: "2026-06-30", shares: 7000000, valueUsd: 1400000000 },
        { reportDate: "2026-03-31", shares: 2500000, valueUsd: 450000000 },
      ],
      META: [],
    },
  },
};

describe("institutional.getInstitutionHistory", () => {
  it("calls the history path with no params by default", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(HISTORY));
    await client.institutional.getInstitutionHistory("Renaissance-Technologies");
    const url = lastUrl();
    expect(url.pathname).toBe("/api/v1/institutional/institution/Renaissance-Technologies/history");
    expect(url.search).toBe("");
  });

  it("sends quarters and sends an array of tickers comma-joined", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(HISTORY));
    await client.institutional.getInstitutionHistory("1037389", {
      quarters: 8,
      tickers: ["NVDA", "META"],
    });
    const url = lastUrl();
    expect(url.pathname).toBe("/api/v1/institutional/institution/1037389/history");
    expect(url.searchParams.get("quarters")).toBe("8");
    expect(url.searchParams.get("tickers")).toBe("NVDA,META");
  });

  it("sends a tickers string as given and omits an empty list", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(HISTORY));
    await client.institutional.getInstitutionHistory("Renaissance-Technologies", { tickers: "NVDA,META" });
    expect(lastUrl().searchParams.get("tickers")).toBe("NVDA,META");

    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(jsonResponse(HISTORY));
    await client.institutional.getInstitutionHistory("Renaissance-Technologies", { tickers: [] });
    expect(lastUrl().searchParams.has("tickers")).toBe(false);
  });

  it("returns the envelope with rows under data.quarters and positions under data.positions", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(HISTORY));
    const result = await client.institutional.getInstitutionHistory("Renaissance-Technologies", {
      tickers: ["NVDA", "META"],
    });
    expectTypeOf(result).toEqualTypeOf<PreviewResponse<InstitutionHistory>>();
    expect(result.isPreview).toBe(false);
    const [newest] = result.data.quarters;
    expect(newest.netFlowUsd).toBe(
      (newest.boughtUsd ?? 0) - (newest.trimmedUsd ?? 0) - (newest.exitedUsd ?? 0),
    );
    expect(result.data.positions?.NVDA[0]).toEqual({
      reportDate: "2026-06-30",
      shares: 7000000,
      valueUsd: 1400000000,
    });
    expect(result.data.positions?.META).toEqual([]);
  });

  it("leaves the comparison fields undefined, never zero, on a filing with nothing to compare", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ...HISTORY, data: { ...HISTORY.data, positions: undefined } }),
    );
    const { data } = await client.institutional.getInstitutionHistory("Renaissance-Technologies");
    const oldest = data.quarters[1];
    expect(oldest.comparisonStatus).toBe("PRIOR_QUARTER_UNAVAILABLE");
    for (const key of [
      "comparisonReportDate",
      "newPositions",
      "increasedPositions",
      "decreasedPositions",
      "soldOutPositions",
      "boughtUsd",
      "trimmedUsd",
      "exitedUsd",
      "netFlowUsd",
      "priceEffectUsd",
    ] as const) {
      expect(oldest[key], key).toBeUndefined();
    }
    expectTypeOf(oldest.netFlowUsd).toEqualTypeOf<number | undefined>();
    expect(data.positions).toBeUndefined();
  });

  it("returns the free preview envelope with totalCount naming the window", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: true,
        previewReason: "PRO_REQUIRED",
        totalCount: 12,
        upgrade: { plan: "PRO" },
        data: { ...HISTORY.data, quarters: [AVAILABLE_ROW], positions: undefined },
      }),
    );
    const result = await client.institutional.getInstitutionHistory("Renaissance-Technologies", {
      quarters: 12,
    });
    expect(result.isPreview).toBe(true);
    expect(result.previewReason).toBe("PRO_REQUIRED");
    expect(result.totalCount).toBe(12);
    expect(result.data.quarters).toHaveLength(1);
  });
});

const HOLDING: InstitutionHolding = {
  ticker: "AAPL",
  companyName: "Apple Inc.",
  shares: 100,
  valueUsd: 400000,
  changeType: "INCREASED",
  sharesChange: 10,
  sharesChangePct: 11.1,
  portfolioWeight: 40.0,
  priorValueUsd: 330000,
  priorPortfolioWeight: 35.0,
  estimatedFlowUsd: 40000,
};

const DETAIL_PAGE = {
  isPreview: false,
  previewReason: null,
  totalCount: 40,
  data: {
    filerCik: "1067983",
    displayName: "Berkshire Hathaway",
    totalValueUsd: 300000000000,
    holdingsCount: 41,
    positionsHeld: 40,
    comparisonStatus: "AVAILABLE",
    comparisonReportDate: "2026-03-31",
    priorTotalValueUsd: 280000000000,
    priorPositionsHeld: 38,
    holdings: [HOLDING],
    returnedCount: 1,
    offset: 0,
    matchTotals: { count: 5, valueUsd: 900000, priorValueUsd: 700000, estimatedFlowUsd: 90000 },
  },
};

const DETAIL_OLD = {
  isPreview: false,
  previewReason: null,
  data: {
    filerCik: "1067983",
    holdings: [{ ticker: "AAPL", shares: 100, valueUsd: 400000, portfolioWeight: 40.0 }],
  },
};

describe("institutional.getInstitutionDetail options", () => {
  it("sends no query string when called as before", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(DETAIL_OLD));
    await client.institutional.getInstitutionDetail("Berkshire-Hathaway");
    const url = lastUrl();
    expect(url.pathname).toBe("/api/v1/institutional/institution/Berkshire-Hathaway");
    expect(url.search).toBe("");
  });

  it("maps every option to its wire name, joining a changeType array", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(DETAIL_PAGE));
    await client.institutional.getInstitutionDetail("Berkshire-Hathaway", {
      limit: 25,
      offset: 50,
      sortBy: "estimatedFlowUsd",
      sortDir: "asc",
      changeType: ["NEW", "INCREASED"],
      q: "app",
      minWeight: 1.5,
    });
    const params = lastUrl().searchParams;
    expect(Object.fromEntries(params)).toEqual({
      limit: "25",
      offset: "50",
      sortBy: "estimatedFlowUsd",
      sortDir: "asc",
      changeType: "NEW,INCREASED",
      q: "app",
      minWeight: "1.5",
    });
  });

  it("sends a single changeType as given, sends zeros, and only the options passed", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(DETAIL_PAGE));
    await client.institutional.getInstitutionDetail("Berkshire-Hathaway", {
      limit: 5,
      offset: 0,
      minWeight: 0,
      changeType: "SOLD_OUT",
    });
    expect(Object.fromEntries(lastUrl().searchParams)).toEqual({
      limit: "5",
      offset: "0",
      minWeight: "0",
      changeType: "SOLD_OUT",
    });
  });

  it("sends HELD as given, alone or combined", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(DETAIL_PAGE));
    await client.institutional.getInstitutionDetail("Berkshire-Hathaway", { limit: 5, changeType: "HELD" });
    expect(lastUrl().searchParams.get("changeType")).toBe("HELD");

    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(jsonResponse(DETAIL_PAGE));
    await client.institutional.getInstitutionDetail("Berkshire-Hathaway", {
      limit: 5,
      changeType: ["HELD", "SOLD_OUT"],
    });
    expect(lastUrl().searchParams.get("changeType")).toBe("HELD,SOLD_OUT");
  });

  it("parses the new fields and still parses a response without them", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(DETAIL_PAGE));
    const page = (await client.institutional.getInstitutionDetail("Berkshire-Hathaway", {
      limit: 1,
    })) as PreviewResponse<InstitutionDetail>;
    expect(page.totalCount).toBe(40);
    expect(page.data.priorTotalValueUsd).toBe(280000000000);
    expect(page.data.priorPositionsHeld).toBe(38);
    const totals: InstitutionMatchTotals | undefined = page.data.matchTotals;
    expect(totals?.estimatedFlowUsd).toBe(90000);
    const holding = page.data.holdings?.[0];
    expectTypeOf(holding?.estimatedFlowUsd).toEqualTypeOf<number | undefined>();
    expect(holding?.priorValueUsd).toBe(330000);
    expect(holding?.priorPortfolioWeight).toBe(35.0);
    expect(holding?.estimatedFlowUsd).toBe(40000);

    mockFetch.mockResolvedValueOnce(jsonResponse(DETAIL_OLD));
    const old = (await client.institutional.getInstitutionDetail(
      "Berkshire-Hathaway",
    )) as PreviewResponse<InstitutionDetail>;
    expect(old.data.priorTotalValueUsd).toBeUndefined();
    expect(old.data.priorPositionsHeld).toBeUndefined();
    expect(old.data.matchTotals).toBeUndefined();
    expect(old.data.holdings?.[0].priorValueUsd).toBeUndefined();
    expect(old.data.holdings?.[0].valueUsd).toBe(400000);
  });

  it("keeps the opaque return type", () => {
    expectTypeOf<ReturnType<typeof client.institutional.getInstitutionDetail>>().toEqualTypeOf<
      Promise<unknown>
    >();
  });
});
