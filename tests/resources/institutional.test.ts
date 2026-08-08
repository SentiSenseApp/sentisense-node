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

describe("institutional.getQuarters", () => {
  it("calls GET /api/v1/institutional/quarters", async () => {
    const quarters = [{ value: "2025-Q4", label: "Q4 2025", reportDate: "2025-12-31" }];
    mockFetch.mockResolvedValueOnce(jsonResponse(quarters));
    const result = await client.institutional.getQuarters();
    expect(result).toEqual(quarters);
  });
});

/**
 * These fixtures mirror the REAL wire shape: the institutional endpoints wrap their
 * payload in the preview envelope `{ isPreview, previewReason, data }`. The declared
 * return types now describe that envelope, so `result.data.inflows` type-checks with no
 * cast. That native `.data` access IS the regression guard: if a signature ever reverts
 * to the flat shape, these lines stop compiling.
 */
function envelope(data: unknown, isPreview = false) {
  return jsonResponse({
    isPreview,
    previewReason: isPreview ? "PRO_REQUIRED" : null,
    data,
  });
}

describe("institutional.getFlows", () => {
  it("passes reportDate and limit, and unwraps the envelope via .data", async () => {
    const flows = { inflows: [{ ticker: "AAPL" }], outflows: [{ ticker: "TSLA" }] };
    mockFetch.mockResolvedValueOnce(envelope(flows));
    const result = await client.institutional.getFlows("2025-12-31", { limit: 20 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("reportDate=2025-12-31");
    expect(url).toContain("limit=20");
    expect(result.isPreview).toBe(false);
    expect(result.data.inflows).toHaveLength(1);
    expect(result.data.outflows).toHaveLength(1);
    // The flat access is the bug this suite exists to catch. It must stay undefined.
    expect((result as unknown as { inflows?: unknown }).inflows).toBeUndefined();
  });

  it("omits reportDate when not provided and surfaces coverage fields", async () => {
    const flows = {
      inflows: [],
      outflows: [],
      reportDate: "2026-06-30",
      isPending: true,
      filerCount: 578,
      baselineFilerCount: 8789,
    };
    mockFetch.mockResolvedValueOnce(envelope(flows));
    const result = await client.institutional.getFlows();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).not.toContain("reportDate=");
    expect(result.data.reportDate).toBe("2026-06-30");
    expect(result.data.isPending).toBe(true);
    expect(result.data.filerCount).toBe(578);
    expect(result.data.baselineFilerCount).toBe(8789);
  });
});

describe("institutional.getHolders", () => {
  it("includes ticker in path and reportDate in params", async () => {
    mockFetch.mockResolvedValueOnce(envelope({ ticker: "AAPL", holders: [] }));
    await client.institutional.getHolders("AAPL", "2025-12-31");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/institutional/holders/AAPL");
    expect(url).toContain("reportDate=2025-12-31");
  });

  it("passes limit, offset, sortBy and sortDir when given", async () => {
    mockFetch.mockResolvedValueOnce(envelope({ ticker: "AAPL", holders: [] }));
    await client.institutional.getHolders("AAPL", "2025-12-31", {
      limit: 5,
      offset: 10,
      sortBy: "valueUsd",
      sortDir: "asc",
    });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("reportDate=2025-12-31");
    expect(url).toContain("limit=5");
    expect(url).toContain("offset=10");
    expect(url).toContain("sortBy=valueUsd");
    expect(url).toContain("sortDir=asc");
  });

  it("sends only the options actually supplied, leaving server defaults alone", async () => {
    mockFetch.mockResolvedValueOnce(envelope({ ticker: "AAPL", holders: [] }));
    await client.institutional.getHolders("AAPL", "2025-12-31", { limit: 25 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("limit=25");
    expect(url).not.toContain("offset=");
    expect(url).not.toContain("sortBy=");
    expect(url).not.toContain("sortDir=");
  });

  it("sends offset=0, which is a real value rather than unset", async () => {
    mockFetch.mockResolvedValueOnce(envelope({ ticker: "AAPL", holders: [] }));
    await client.institutional.getHolders("AAPL", "2025-12-31", { limit: 5, offset: 0 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("offset=0");
  });

  it("omits every paging param when options are omitted", async () => {
    mockFetch.mockResolvedValueOnce(envelope({ ticker: "AAPL", holders: [] }));
    await client.institutional.getHolders("AAPL", "2025-12-31");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).not.toContain("limit=");
    expect(url).not.toContain("offset=");
    expect(url).not.toContain("sortBy=");
    expect(url).not.toContain("sortDir=");
  });

  it("nests the holder rows two levels deep, under data.holders", async () => {
    const payload = {
      ticker: "AAPL",
      companyName: "Apple Inc",
      reportDate: "2026-06-30",
      totalInstitutionalShares: 9_000_000_000,
      totalInstitutionalValue: 2_800_000_000_000,
      holderCount: 2,
      holders: [
        { filerCik: "1", filerName: "A", changeType: "NEW" },
        { filerCik: "2", filerName: "B", changeType: "INCREASED" },
      ],
    };
    mockFetch.mockResolvedValueOnce(envelope(payload));
    const result = await client.institutional.getHolders("AAPL", "2026-06-30");
    expect(result.data.holderCount).toBe(2);
    expect(result.data.holders).toHaveLength(2);
    expect(result.data.holders.filter((h) => h.changeType === "NEW")).toHaveLength(1);
  });

  /**
   * Fixture copied from a live paged response. Passing `limit` makes the server add three
   * fields the unpaged response does not have, and the reason to assert them here is the
   * access, not the values: every `result.data.X` below is native typed access, so if
   * `TickerHolders` ever loses one of these fields again, this file stops compiling under
   * `npm run typecheck` instead of forcing callers into a cast.
   */
  it("types the paging fields a limited request adds to the payload", async () => {
    const row = {
      filerCik: "0000895421",
      filerName: "Morgan Stanley",
      filerCategory: "BANK",
      shares: 244_475_958,
      valueUsd: 62_045_554_181,
      changeType: "INCREASED",
      sharesChange: 13_990_330,
      sharesChangePct: 6.07,
      entitySlug: "Morgan-Stanley",
      cikCount: 2,
    };
    const payload = {
      ticker: "AAPL",
      companyName: "APPLE INC",
      reportDate: "2026-03-31",
      totalInstitutionalShares: 9_344_335_315,
      totalInstitutionalValue: 2_367_300_875_553,
      holderCount: 6044,
      holders: [row],
      returnedCount: 1,
      offset: 5,
      notableChanges: { count: 1031, top: [row] },
    };
    mockFetch.mockResolvedValueOnce(envelope(payload));
    const result = await client.institutional.getHolders("AAPL", "2026-03-31", {
      limit: 1,
      offset: 5,
    });

    expect(result.data.returnedCount).toBe(1);
    expect(result.data.offset).toBe(5);
    // returnedCount is the page; holderCount stays the ticker-wide total.
    expect(result.data.holderCount).toBe(6044);
    expect(result.data.notableChanges?.count).toBe(1031);
    expect(result.data.notableChanges?.top[0].filerName).toBe("Morgan Stanley");
    // notableChanges.top rows are Holder rows, so they carry the same fields.
    expect(result.data.notableChanges?.top[0].changeType).toBe("INCREASED");
  });

  it("types entitySlug and cikCount on holder rows", async () => {
    const payload = {
      ticker: "GME",
      holderCount: 2,
      holders: [
        { filerCik: "1", filerName: "Vanguard", entitySlug: "Vanguard", cikCount: null },
        { filerCik: "2", filerName: "Unmatched Filer", entitySlug: null, cikCount: null },
      ],
    };
    mockFetch.mockResolvedValueOnce(envelope(payload));
    const result = await client.institutional.getHolders("GME", "2025-12-31");

    // A linkable filer resolves to a slug getInstitutionDetail accepts.
    expect(result.data.holders[0].entitySlug).toBe("Vanguard");
    // An unmatched filer sends null, so a caller must check before building a link.
    expect(result.data.holders[1].entitySlug).toBeNull();
    // cikCount is null for a single-CIK filer, which is the common case.
    expect(result.data.holders[0].cikCount).toBeNull();
  });

  it("leaves the paging fields undefined on an unpaged response", async () => {
    const payload = { ticker: "GME", holderCount: 352, holders: [] };
    mockFetch.mockResolvedValueOnce(envelope(payload));
    const result = await client.institutional.getHolders("GME", "2025-12-31");

    expect(result.data.returnedCount).toBeUndefined();
    expect(result.data.offset).toBeUndefined();
    expect(result.data.notableChanges).toBeUndefined();
  });
});

describe("institutional.getActivists", () => {
  it("passes reportDate and returns the array under data", async () => {
    mockFetch.mockResolvedValueOnce(envelope([{ filerCik: "1", filerName: "A" }]));
    const result = await client.institutional.getActivists("2025-12-31");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/institutional/activist");
    expect(url).toContain("reportDate=2025-12-31");
    expect(result.data).toHaveLength(1);
  });
});
