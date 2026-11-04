import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import SentiSense, {
  type AnalystEarningsSurprise,
  type GraphNode,
  type InstitutionDetail,
  type OptionsSummary,
  type PreviewResponse,
} from "../../src/index.js";

const payloads = JSON.parse(
  readFileSync(new URL("../fixtures/response_additions.json", import.meta.url), "utf8"),
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

describe("optional response fields", () => {
  it.each([
    ["optionsDelisted", "DELISTED", "2026-08-05"],
    ["optionsDelistedUnknownDate", "DELISTED", undefined],
    ["optionsListed", undefined, undefined],
  ])("reads listing markers from %s", async (fixture, status, date) => {
    respond(payloads[fixture!]);
    const result = await client.stocks.getOptionsSummary("EA");
    expect(result.data?.listingStatus).toBe(status);
    expect(result.data?.delistedDate).toBe(date);
    expect(result.data?.asOf).toBe("2026-08-04");
    expect(result.data?.latest?.atmIv).toBe(0);
    expect(result.data?.context?.ivRank1y).toBe(0);
    expect(Object.prototype.hasOwnProperty.call(result.data, "listingStatus")).toBe(status !== undefined);
    expect(Object.prototype.hasOwnProperty.call(result.data, "delistedDate")).toBe(date !== undefined);
  });

  it("keeps true percentages, legacy fractions and null surprises unchanged", async () => {
    respond(payloads.estimates);
    const result = await client.analyst.estimates("ADI");
    expectTypeOf(result.data.surprises[0].surprisePct).toEqualTypeOf<number | null | undefined>();
    expect(result.data.surprises[0].surprisePct).toBe(3.29);
    expect(result.data.surprises[0].surprisePercent).toBe(0.03);
    expect(result.data.surprises[1].surprisePct).toBe(50);
    expect(result.data.surprises[2].surprisePct).toBeNull();
    respond(payloads.estimatesLegacy);
    const legacy = await client.analyst.estimates("ADI");
    expect(legacy.data.surprises[0].surprisePct).toBeUndefined();
    expect(legacy.data.surprises[0].surprisePercent).toBe(0.03);
  });

  it.each([
    ["earningsSummaries", 9], ["earningsSummariesEmpty", 0], ["earningsSummariesLegacy", undefined],
  ] as const)("keeps the index count on the %s envelope", async (fixture, count) => {
    respond(payloads[fixture]);
    const result = await client.earnings.getSummaries("ADI", { limit: 1 });
    expectTypeOf(result.totalCount).toEqualTypeOf<number | undefined>();
    expect(result.isPreview).toBe(false);
    expect(result.totalCount).toBe(count);
    expect(result.data).toHaveLength(payloads[fixture].data.length);
    expect(result.data.every((row) => !Object.prototype.hasOwnProperty.call(row, "totalCount"))).toBe(true);
  });

  it.each([false, true])("exposes the full positions count on a preview=%s detail", async (preview) => {
    respond({ ...payloads.institutionDetail, isPreview: preview,
      previewReason: preview ? "PRO_REQUIRED" : null });
    const result = await client.institutional.getInstitutionDetail("1067983") as PreviewResponse<InstitutionDetail>;
    expectTypeOf(result.data.positionsHeld).toEqualTypeOf<number | undefined>();
    expect(result.data.positionsHeld).toBe(3);
    expect(result.data.holdingsCount).toBe(4);
    expect(result.data.soldOutPositions).toBe(1);
    expect(result.data.holdings).toHaveLength(1);
    expect(result.isPreview).toBe(preview);
    const { positionsHeld, ...legacy } = payloads.institutionDetail.data;
    respond({ ...payloads.institutionDetail, data: legacy });
    const old = await client.institutional.getInstitutionDetail("1067983") as PreviewResponse<InstitutionDetail>;
    expect(old.data.positionsHeld).toBeUndefined();
  });

  it.each(["Smartphones", "", "  Mixed Case Category  ", undefined])(
    "passes through optional product category %s", async (category) => {
      const { category: omitted, ...product } = payloads.stockGraph.nodes[1];
      respond({ ...payloads.stockGraph, nodes: [payloads.stockGraph.nodes[0],
        category === undefined ? product : { ...product, category }, payloads.stockGraph.nodes[2]] });
      const graph = await client.stocks.getGraph("AAPL");
      expectTypeOf(graph.nodes[1].category).toEqualTypeOf<string | undefined>();
      expect(graph.nodes[1].category).toBe(category);
      expect(graph.nodes[0].category).toBeUndefined();
      expect(graph.nodes[2].category).toBeUndefined();
    },
  );

  it("keeps optional declarations and the opaque detail signature compatible", () => {
    const detail: InstitutionDetail = {};
    const summary: OptionsSummary = {};
    const node: GraphNode = { slug: "phone", displayName: "Phone", type: "PRODUCT_OR_SERVICE" };
    const surprise: AnalystEarningsSurprise = {
      periodLabel: null, reportDate: null, estimateEps: null, actualEps: null, surprisePercent: null,
    };
    expect(detail.positionsHeld).toBeUndefined();
    expect(summary.listingStatus).toBeUndefined();
    expect(node.category).toBeUndefined();
    expect(surprise.surprisePct).toBeUndefined();
    expectTypeOf<ReturnType<typeof client.institutional.getInstitutionDetail>>().toEqualTypeOf<Promise<unknown>>();
    // An implementation previously allowed by the opaque return signature.
    const existingImplementation: typeof client.institutional.getInstitutionDetail = async () => "opaque";
    expect(typeof existingImplementation).toBe("function");
  });

  it("keeps the sample flag and sample tickers on the preview envelope", async () => {
    respond({
      isPreview: false,
      previewReason: null,
      sampleCompany: true,
      data: { ticker: "AAPL", companyName: "Apple Inc.", kpis: [] },
    });
    const full = await client.stocks.getKpis("AAPL");
    expectTypeOf(full.sampleCompany).toEqualTypeOf<boolean | undefined>();
    expect(full.sampleCompany).toBe(true);
    // The retired bare `sample` key is not part of the type.
    expectTypeOf(full).not.toHaveProperty("sample");
    expect(full.isPreview).toBe(false);

    respond({
      isPreview: true,
      previewReason: "PRO_REQUIRED",
      upgrade: { plan: "PRO", sampleTickers: ["TSLA", "MSFT"] },
      data: { ticker: "MSFT", companyName: "Microsoft", kpis: [] },
    });
    const preview = await client.stocks.getKpis("MSFT");
    expectTypeOf(preview.upgrade?.sampleTickers).toEqualTypeOf<string[] | undefined>();
    expect(preview.upgrade?.sampleTickers).toEqual(["TSLA", "MSFT"]);
    expect(preview.sampleCompany).toBeUndefined();
  });

  it("still parses envelopes without the sample fields", async () => {
    respond({
      isPreview: true,
      previewReason: "PRO_REQUIRED",
      upgrade: { plan: "PRO" },
      data: { ticker: "MSFT", companyName: "Microsoft", kpis: [] },
    });
    const result = await client.stocks.getKpis("MSFT");
    expect(result.sampleCompany).toBeUndefined();
    expect(result.upgrade?.sampleTickers).toBeUndefined();
    expect(result.data.ticker).toBe("MSFT");
  });

  it("keeps the sample flag on KPI coverage rows when present", async () => {
    respond({
      count: 2,
      tickers: [
        { ticker: "AAPL", companyName: "Apple Inc.", lastUpdated: "2026-04-30", kpiCount: 8, sampleCompany: true },
        { ticker: "TSLA", companyName: "Tesla, Inc.", lastUpdated: "2026-04-15", kpiCount: 6 },
      ],
    });
    const coverage = await client.stocks.listKpiCoverage();
    expect(coverage.tickers[0].sampleCompany).toBe(true);
    expect(coverage.tickers[1].sampleCompany).toBeUndefined();
    expectTypeOf(coverage.tickers[0]).not.toHaveProperty("sample");
    expect(coverage.tickers[1].kpiCount).toBe(6);
  });
});
