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

describe("institutional.getFlows", () => {
  it("passes reportDate and limit", async () => {
    const data = { inflows: [{ ticker: "AAPL" }], outflows: [{ ticker: "TSLA" }] };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));
    const result = await client.institutional.getFlows("2025-12-31", { limit: 20 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("reportDate=2025-12-31");
    expect(url).toContain("limit=20");
    expect(result.inflows).toHaveLength(1);
    expect(result.outflows).toHaveLength(1);
  });
});

describe("institutional.getHolders", () => {
  it("includes ticker in path and reportDate in params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.institutional.getHolders("AAPL", "2025-12-31");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/institutional/holders/AAPL");
    expect(url).toContain("reportDate=2025-12-31");
  });
});

describe("institutional.getActivists", () => {
  it("passes reportDate", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.institutional.getActivists("2025-12-31");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/institutional/activist");
    expect(url).toContain("reportDate=2025-12-31");
  });
});
