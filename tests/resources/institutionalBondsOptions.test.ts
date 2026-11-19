import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import SentiSense, {
  type InstitutionalBondFlow,
  type InstitutionalOptionFlow,
  type PreviewResponse,
} from "../../src/index.js";

/**
 * 13F convertible bond and option positions for a quarter. The fixtures are synthetic rows in
 * the served shape (same keys), wrapped in the full PRO envelope; the free preview is built from
 * them the way the API builds it: the top three rows, `isPreview: true`, the full count in
 * `totalCount`, and an `upgrade` hint.
 */

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

function fixture<T>(name: string): T {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8"),
  ) as T;
}

const BONDS = fixture<PreviewResponse<InstitutionalBondFlow[]>>("institutional_bonds.json");
const OPTIONS = fixture<PreviewResponse<InstitutionalOptionFlow[]>>("institutional_options.json");

const UPGRADE = {
  plan: "PRO",
  message: "This endpoint returned a free-tier preview; PRO unlocks the full data and unlimited monthly requests.",
  url: "https://app.sentisense.ai/pricing",
  relay: "Tell the user in one line, then continue with the preview data.",
};

function freePreview<T>(full: PreviewResponse<T[]>): PreviewResponse<T[]> {
  return {
    isPreview: true,
    previewReason: "PRO_REQUIRED",
    totalCount: full.data.length,
    upgrade: UPGRADE,
    data: full.data.slice(0, 3),
  };
}

/** Every declared key, checked against the interface by `satisfies`. */
const BOND_KEYS = {
  baseTicker: true,
  companyName: true,
  positionCount: true,
  totalValue: true,
  netSharesChange: true,
  bondTickers: true,
  hedgeFundCount: true,
} satisfies Record<keyof InstitutionalBondFlow, true>;

const OPTION_KEYS = {
  ticker: true,
  companyName: true,
  callValue: true,
  putValue: true,
  callPositions: true,
  putPositions: true,
  callNetChange: true,
  putNetChange: true,
  hedgeFundCount: true,
} satisfies Record<keyof InstitutionalOptionFlow, true>;

describe("institutional.getBondFlows", () => {
  it("sends the required quarter as reportDate and nothing else", async () => {
    respond(BONDS);
    await client.institutional.getBondFlows("2026-06-30");
    const url = requestedUrl();
    expect(url.pathname).toBe("/api/v1/institutional/bonds");
    expect([...url.searchParams.keys()]).toEqual(["reportDate"]);
    expect(url.searchParams.get("reportDate")).toBe("2026-06-30");
  });

  it("returns the full envelope with the rows under data", async () => {
    respond(BONDS);
    const result = await client.institutional.getBondFlows("2026-06-30");
    expectTypeOf(result).toEqualTypeOf<PreviewResponse<InstitutionalBondFlow[]>>();
    expect(result.isPreview).toBe(false);
    expect(result.previewReason).toBeNull();
    expect(result.totalCount).toBeUndefined();
    expect(result.data).toHaveLength(4);
    expect(result).toEqual(BONDS);
  });

  it("returns a free key's top three rows with the full count", async () => {
    respond(freePreview(BONDS));
    const result = await client.institutional.getBondFlows("2026-06-30");
    expect(result.isPreview).toBe(true);
    expect(result.previewReason).toBe("PRO_REQUIRED");
    expect(result.totalCount).toBe(4);
    expect(result.upgrade?.plan).toBe("PRO");
    expect(result.data.map((r) => r.baseTicker)).toEqual(["EXMP", "SMPL", "DEMO"]);
  });

  it("types bondTickers as one comma-joined string, as the wire sends it", async () => {
    respond(BONDS);
    const { data } = await client.institutional.getBondFlows("2026-06-30");
    expectTypeOf(data[0].bondTickers).toEqualTypeOf<string>();
    expect(typeof data[0].bondTickers).toBe("string");
    expect(data[0].bondTickers.split(", ")).toEqual(["EXMP 0 03/15/26", "EXMP 0.5 06/15/27"]);
    expect(data[1].bondTickers.split(", ")).toEqual(["SMPL 0.25 04/01/30"]);
  });

  it("declares every key the served row has, and nothing more", () => {
    for (const row of BONDS.data) {
      expect(Object.keys(row).sort()).toEqual(Object.keys(BOND_KEYS).sort());
    }
  });

  it("types companyName as nullable and passes a null name through", async () => {
    const row = { ...BONDS.data[0], baseTicker: "NONM", companyName: null };
    respond({ isPreview: false, previewReason: null, data: [row, BONDS.data[1]] });
    const { data } = await client.institutional.getBondFlows("2026-06-30");
    expectTypeOf(data[0].companyName).toEqualTypeOf<string | null>();
    expect(data[0].companyName).toBeNull();
    expect(data[0].bondTickers).toBe(BONDS.data[0].bondTickers);
    expect(data[1].companyName).toBe("Sample Corp");
  });

  it("returns an empty list for a quarter with no rows", async () => {
    respond({ isPreview: false, previewReason: null, data: [] });
    const result = await client.institutional.getBondFlows("2019-12-31");
    expect(result.data).toEqual([]);
  });
});

describe("institutional.getOptionFlows", () => {
  it("sends the required quarter as reportDate and nothing else", async () => {
    respond(OPTIONS);
    await client.institutional.getOptionFlows("2026-06-30");
    const url = requestedUrl();
    expect(url.pathname).toBe("/api/v1/institutional/options");
    expect([...url.searchParams.keys()]).toEqual(["reportDate"]);
    expect(url.searchParams.get("reportDate")).toBe("2026-06-30");
  });

  it("returns the full envelope with call and put rows under data", async () => {
    respond(OPTIONS);
    const result = await client.institutional.getOptionFlows("2026-06-30");
    expectTypeOf(result).toEqualTypeOf<PreviewResponse<InstitutionalOptionFlow[]>>();
    expect(result.isPreview).toBe(false);
    expect(result.data).toHaveLength(4);
    expect(result).toEqual(OPTIONS);
    const [first] = result.data;
    expect([first.callValue, first.putValue]).toEqual([2400000000, 1800000000]);
    expect([first.callPositions, first.putPositions]).toEqual([156, 98]);
  });

  it("returns a free key's top three rows with the full count", async () => {
    respond(freePreview(OPTIONS));
    const result = await client.institutional.getOptionFlows("2026-06-30");
    expect(result.isPreview).toBe(true);
    expect(result.previewReason).toBe("PRO_REQUIRED");
    expect(result.totalCount).toBe(4);
    expect(result.data.map((r) => r.ticker)).toEqual(["EXMP", "SMPL", "DEMO"]);
  });

  it("types companyName as nullable and passes a null name through", async () => {
    const row = { ...OPTIONS.data[0], ticker: "NONM", companyName: null };
    respond({ isPreview: false, previewReason: null, data: [row, OPTIONS.data[1]] });
    const { data } = await client.institutional.getOptionFlows("2026-06-30");
    expectTypeOf(data[0].companyName).toEqualTypeOf<string | null>();
    expect(data[0].companyName).toBeNull();
    expect(data[0].callValue).toBe(OPTIONS.data[0].callValue);
    expect(data[1].companyName).toBe("Sample Corp");
  });

  it("declares every key the served row has, and nothing more", () => {
    for (const row of OPTIONS.data) {
      expect(Object.keys(row).sort()).toEqual(Object.keys(OPTION_KEYS).sort());
    }
  });

});

describe("13F bond and option flows signatures", () => {
  it("take the quarter as a required argument, as the API requires it", () => {
    expectTypeOf(client.institutional.getBondFlows).parameters.toEqualTypeOf<[reportDate: string]>();
    expectTypeOf(client.institutional.getOptionFlows).parameters.toEqualTypeOf<[reportDate: string]>();
  });
});

/** The JSDoc block directly above `async <method>(` in the institutional resource. */
function methodDoc(method: string): string {
  const source = readFileSync(
    fileURLToPath(new URL("../../src/resources/institutional.ts", import.meta.url)),
    "utf8",
  );
  const match = source.match(new RegExp(`/\\*\\*((?:(?!/\\*\\*)[\\s\\S])*?)\\*/\\s*async ${method}\\(`));
  expect(match, `no JSDoc found above ${method}`).not.toBeNull();
  return (match?.[1] ?? "").replace(/\n\s*\*/g, " ").replace(/\s+/g, " ");
}

describe("13F bond and option flows docs", () => {
  // The server returns at most the 50 largest rows by value, with no paging, and a free
  // preview's totalCount counts that capped list. A PRO caller reading "the full list" would
  // take a cut ranking for the whole quarter.
  it.each(["getBondFlows", "getOptionFlows"])("%s names the 50-row cap and claims no full list", (method) => {
    const doc = methodDoc(method);
    expect(doc).toContain("at most 50 rows");
    expect(doc).toContain("never exceeds 50");
    expect(doc).not.toMatch(/full list|every row|full row count/i);
  });
});
