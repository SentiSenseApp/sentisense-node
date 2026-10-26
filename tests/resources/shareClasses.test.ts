import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import SentiSense, {
  type EarningsQuarter,
  type EarningsSummariesResponse,
  type PreviewResponse,
  type ShareClass,
} from "../../src/index.js";

// Trimmed live responses. Estimates and earnings summaries are stored under a
// company's primary share class, so BRK-A answers with BRK.B figures and names that
// listing in `ticker`. Every field is optional on the wire, so payloads without it
// (single-class companies, older servers) must still read cleanly.
const payloads = JSON.parse(
  readFileSync(new URL("../fixtures/share_classes_live.json", import.meta.url), "utf8"),
);
const mockFetch = vi.fn();
const client = new SentiSense({ apiKey: "ssk_test" });

beforeEach(() => vi.stubGlobal("fetch", mockFetch));
afterEach(() => vi.unstubAllGlobals());

function respond(payload: unknown) {
  mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(payload), {
    status: 200, headers: { "Content-Type": "application/json" },
  }));
}

describe("profile shareClasses", () => {
  it.each([
    ["profileBrkA", [["BRK.B", true], ["BRK.A", false]]],
    ["profileGoog", [["GOOGL", true], ["GOOG", false]]],
  ] as const)("lists every class of %s, primary first", async (fixture, expected) => {
    respond(payloads[fixture]);
    const profile = await client.stocks.getProfile("X");
    expectTypeOf(profile.shareClasses).toEqualTypeOf<ShareClass[] | undefined>();
    expect(profile.shareClasses?.map((c) => [c.ticker, c.primary])).toEqual(expected);
    expect(profile.shareClasses?.map((c) => c.ticker)).toContain(profile.ticker);
  });

  it("is absent for a single-class company", async () => {
    respond(payloads.profileAapl);
    const profile = await client.stocks.getProfile("AAPL");
    expect(profile.shareClasses).toBeUndefined();
  });
});

describe("detailed rows shareClasses", () => {
  it.each(["listDetailed", "listPopularDetailed"] as const)(
    "%s keeps the field on the primary row only", async (method) => {
      respond(payloads.detailedRows);
      const rows = await client.stocks[method]();
      const byTicker = new Map(rows.map((r) => [r.ticker, r]));
      expectTypeOf(rows[0].shareClasses).toEqualTypeOf<ShareClass[] | undefined>();
      expect(byTicker.get("BRK.B")?.shareClasses).toEqual([
        { ticker: "BRK.B", primary: true },
        { ticker: "BRK.A", primary: false },
      ]);
      expect(byTicker.get("GOOGL")?.shareClasses?.[1].ticker).toBe("GOOG");
      expect(byTicker.has("BRK.A")).toBe(false);
      expect(byTicker.get("AAPL")?.shareClasses).toBeUndefined();
      expect(byTicker.get("AAPL")?.name).toBe("Apple");
    },
  );
});

describe("analyst.estimates ticker", () => {
  it("BRK-A answers BRK.B", async () => {
    respond(payloads.estimatesBrkA);
    const result = await client.analyst.estimates("BRK-A");
    expectTypeOf(result.data.ticker).toEqualTypeOf<string | undefined>();
    expect(result.data.ticker).toBe("BRK.B");
    expect(result.data.estimates[0].periodType).toBe("CURRENT_QUARTER");
  });

  it("reads undefined on an older payload", async () => {
    respond(payloads.estimatesLegacy);
    const result = await client.analyst.estimates("BRK-A");
    expect(result.data.ticker).toBeUndefined();
    expect(result.data.surprises[0].surprisePct).toBe(17.35);
  });
});

describe("earnings.getSummaries envelope ticker", () => {
  it("BRK-A answers BRK.B on an empty list", async () => {
    respond(payloads.earningsSummariesBrkA);
    const result = await client.earnings.getSummaries("BRK-A", { limit: 1 });
    expectTypeOf(result).toEqualTypeOf<EarningsSummariesResponse>();
    expectTypeOf(result.ticker).toEqualTypeOf<string | undefined>();
    expect(result.ticker).toBe("BRK.B");
    expect(result.data).toEqual([]);
    expect(result.isPreview).toBe(false);
    expect(result.totalCount).toBe(0);
  });

  it("GOOG answers GOOGL and the envelope keeps its other fields", async () => {
    respond(payloads.earningsSummariesGoog);
    const result = await client.earnings.getSummaries("GOOG", { limit: 1 });
    expect(result.ticker).toBe("GOOGL");
    expect(result.data).toHaveLength(1);
    expect(result.data[0].fiscalPeriod).toBe(payloads.earningsSummariesGoog.data[0].fiscalPeriod);
    expect(result.totalCount).toBe(payloads.earningsSummariesGoog.totalCount);
    // Still assignable to the generic envelope, so existing annotations compile.
    const generic: PreviewResponse<EarningsQuarter[]> = result;
    expect(generic.previewReason).toBeNull();
  });

  it("reads undefined on an older payload", async () => {
    respond(payloads.earningsSummariesLegacy);
    const result = await client.earnings.getSummaries("GOOG");
    expect(result.ticker).toBeUndefined();
    expect(result.data).toHaveLength(1);
  });
});
