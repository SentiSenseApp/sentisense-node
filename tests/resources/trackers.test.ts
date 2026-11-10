import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense, {
  APIError,
  type TrackerFilter,
  type TrackerGetParams,
  type TrackerTableRow,
} from "../../src/index.js";
import { serializeTrackerFilter } from "../../src/resources/trackers.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function calledUrl(): URL {
  return new URL(mockFetch.mock.calls[0][0] as string);
}

const client = new SentiSense({ apiKey: "ssk_test", maxRetries: 0 });

const FILING_ROW = {
  rank: 13,
  rowId: "company-filing-aep-10-q",
  name: "American Electric Power (AEP): 10-Q",
  category: "company-filing",
  url: "/stocks/AEP",
  metrics: [{ label: "State", value: null, unit: "text" }],
  ticker: "AEP",
  statesNamed: ["TX"],
};

const LOCAL_ROW = {
  rank: 2,
  rowId: "local-example",
  name: "Example County, TX: pause",
  category: "local",
  metrics: [{ label: "Ends", value: "June 30, 2027", unit: "text" }],
  endsDate: "2027-06-30",
};

const EMPTY_ENVELOPE = { isPreview: false, previewReason: null, totalCount: 0, data: { trackerId: "x" } };

describe("trackers.list", () => {
  it("types the filters a tracker declares and leaves them absent elsewhere", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        trackers: [
          { trackerId: "institution-aum", displayName: "AUM", category: "institutional", viewType: "table" },
          {
            trackerId: "data-center-moratoriums",
            displayName: "Moratoriums",
            category: "policy",
            viewType: "table",
            filters: [
              { key: "category", values: ["federal", "state", "local", "governor", "company-filing"] },
              { key: "state", values: ["AZ", "FEDERAL", "TX"] },
            ],
          },
        ],
      }),
    );
    const { trackers } = await client.trackers.list();
    expect(trackers[0].filters).toBeUndefined();
    const filters: TrackerFilter[] = trackers[1].filters ?? [];
    expect(filters.map((f) => f.key)).toEqual(["category", "state"]);
    expect(filters[1].values).toContain("TX");
  });
});

describe("trackers.get rows", () => {
  it("carries ticker, url, endsDate and statesNamed as typed fields", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: false,
        previewReason: null,
        totalCount: 2,
        data: { trackerId: "data-center-moratoriums", viewType: "table", rows: [FILING_ROW, LOCAL_ROW] },
      }),
    );
    const snap = await client.trackers.get("data-center-moratoriums");
    const [filing, local] = snap.data.rows as TrackerTableRow[];
    const ticker: string | undefined = filing.ticker;
    const statesNamed: string[] | undefined = filing.statesNamed;
    const endsDate: string | undefined = local.endsDate;
    expect(ticker).toBe("AEP");
    expect(filing.url).toBe("/stocks/AEP");
    expect(statesNamed).toEqual(["TX"]);
    expect(filing.endsDate).toBeUndefined();
    expect(endsDate).toBe("2027-06-30");
    expect(local.ticker).toBeUndefined();
    expect(local.statesNamed).toBeUndefined();
  });

  it("keeps other named cells readable", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        isPreview: false,
        previewReason: null,
        data: {
          trackerId: "market-heatmap",
          viewType: "heatmap",
          rows: [{ rank: 1, rowId: "NVDA", name: "NVIDIA", category: "IT", url: "/stocks/NVDA", metrics: [], ticker: "NVDA", marketCap: 4.4e12 }],
        },
      }),
    );
    const snap = await client.trackers.get("market-heatmap", { scope: "nasdaq100" });
    const row = snap.data.rows![0];
    expect(row.ticker).toBe("NVDA");
    expect(row.marketCap).toBe(4.4e12);
  });
});

describe("trackers.get filter", () => {
  it("serializes an object filter as key:value pairs in order", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(EMPTY_ENVELOPE));
    await client.trackers.get("data-center-moratoriums", { filter: { state: "TX", category: "local" } });
    const url = calledUrl();
    expect(url.pathname).toBe("/api/v1/trackers/data-center-moratoriums");
    expect(url.searchParams.get("filter")).toBe("state:TX,category:local");
  });

  it("passes a string filter through unchanged", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(EMPTY_ENVELOPE));
    await client.trackers.get("data-center-moratoriums", { filter: "state:TX" });
    expect(calledUrl().searchParams.get("filter")).toBe("state:TX");
  });

  it("combines filter with the existing params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(EMPTY_ENVELOPE));
    await client.trackers.get("data-center-moratoriums", { filter: { state: "TX" }, scope: "x" });
    const params = calledUrl().searchParams;
    expect(params.get("filter")).toBe("state:TX");
    expect(params.get("scope")).toBe("x");
  });

  it("leaves existing calls unchanged", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(EMPTY_ENVELOPE));
    const legacy: Record<string, string | number | boolean> = { scope: "nasdaq100" };
    await client.trackers.get("market-heatmap", legacy);
    expect(calledUrl().search).toBe("?scope=nasdaq100");

    mockFetch.mockResolvedValueOnce(jsonResponse(EMPTY_ENVELOPE));
    await client.trackers.get("institution-aum", { category: "" });
    expect(new URL(mockFetch.mock.calls[1][0] as string).searchParams.get("category")).toBe("");

    mockFetch.mockResolvedValueOnce(jsonResponse(EMPTY_ENVELOPE));
    await client.trackers.get("institution-aum");
    expect(new URL(mockFetch.mock.calls[2][0] as string).search).toBe("");
  });

  it("skips an undefined filter", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(EMPTY_ENVELOPE));
    const params: TrackerGetParams = { filter: undefined, scope: "sp500" };
    await client.trackers.get("market-heatmap", params);
    expect(calledUrl().searchParams.has("filter")).toBe(false);
  });

  it("serializeTrackerFilter handles both forms", () => {
    expect(serializeTrackerFilter({ state: "TX", category: "local" })).toBe("state:TX,category:local");
    expect(serializeTrackerFilter("category:governor")).toBe("category:governor");
  });
});

describe("trackers.get errors", () => {
  it("surfaces invalid_filter as an APIError with its code", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "invalid_filter", message: "Unknown value 'ZZ' for filter 'state'." }, 400),
    );
    const error = await client.trackers
      .get("data-center-moratoriums", { filter: { state: "ZZ" } })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).status).toBe(400);
    expect((error as APIError).code).toBe("invalid_filter");
  });

  it("surfaces invalid_scope the same way", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "invalid_scope", message: "Unknown scope 'zz'." }, 400),
    );
    const error = await client.trackers.get("market-heatmap", { scope: "zz" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).code).toBe("invalid_scope");
  });
});
