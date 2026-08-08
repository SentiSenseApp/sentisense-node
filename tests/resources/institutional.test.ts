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
