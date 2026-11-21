import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense, { SentiSenseError } from "../src/index.js";

/**
 * Only API paths leave the client.
 *
 * `get` and `post` are internal, but JavaScript cannot hide them, so anything that calls them
 * with a value that is not an API path (a page path, another host, a number, an object) used to
 * send a request to that URL with the caller's key attached. The client now refuses such a path
 * before any request is made.
 */

const mockFetch = vi.fn();

beforeEach(() => vi.stubGlobal("fetch", mockFetch));
afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

function okResponse(): Response {
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
}

// The internal methods, reached the way any caller can reach them at runtime.
type Internal = {
  get(path: unknown, params?: unknown): Promise<unknown>;
  post(path: unknown, body: unknown): Promise<unknown>;
};

const client = new SentiSense({ apiKey: "ssk_test", maxRetries: 0 });
const internal = client as unknown as Internal;

const NOT_API_PATHS: unknown[] = [
  "test",
  "/test",
  "PURCHASE",
  "/connect",
  "/api",
  "api/v1/stocks",
  "//attacker.example/api/v1/stocks",
  "https://attacker.example/api/v1/stocks",
  "",
  0,
  500,
  -1,
  null,
  undefined,
  {},
  ["/api/v1/stocks"],
];

describe("request paths", () => {
  it.each(NOT_API_PATHS.map((p) => [p]))("get refuses %j without a request", async (path) => {
    mockFetch.mockImplementation(async () => okResponse());
    await expect(internal.get(path)).rejects.toBeInstanceOf(SentiSenseError);
    await expect(internal.get(path)).rejects.toThrow(/API paths start with \/api\//);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each(NOT_API_PATHS.map((p) => [p]))("post refuses %j without a request", async (path) => {
    mockFetch.mockImplementation(async () => okResponse());
    await expect(internal.post(path, {})).rejects.toBeInstanceOf(SentiSenseError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["/api/v1/trackers/../../../connect"],
    ["/api/v1/trackers/%2e%2e/%2e%2e/%2e%2e/connect"],
    ["/api/../connect"],
  ])("get refuses %j, which resolves outside /api/", async (path) => {
    mockFetch.mockImplementation(async () => okResponse());
    await expect(internal.get(path)).rejects.toThrow(/API paths start with \/api\//);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("a method's unencoded id cannot climb out of /api/", async () => {
    mockFetch.mockImplementation(async () => okResponse());
    await expect(client.trackers.get("../../../connect")).rejects.toBeInstanceOf(SentiSenseError);
    await expect(client.indexes.get("../../../connect")).rejects.toBeInstanceOf(SentiSenseError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("an API path still goes to the configured host", async () => {
    mockFetch.mockImplementation(async () => okResponse());
    await internal.get("/api/v1/stocks", { limit: 3 });
    await internal.post("/api/v1/screener/execute", {});
    expect(mockFetch.mock.calls.map((c) => String(c[0]))).toEqual([
      "https://app.sentisense.ai/api/v1/stocks?limit=3",
      "https://app.sentisense.ai/api/v1/screener/execute",
    ]);
  });

  it("a custom base URL keeps working", async () => {
    mockFetch.mockImplementation(async () => okResponse());
    const local = new SentiSense({ apiKey: "ssk_test", baseUrl: "http://localhost:8080/" });
    await local.stocks.getQuote("AAPL");
    expect(String(mockFetch.mock.calls[0][0])).toBe("http://localhost:8080/api/v1/stocks/AAPL/quote");
  });

  it("the refusal message stays short for a long value", async () => {
    const error = await internal.get("x".repeat(5000)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SentiSenseError);
    expect((error as Error).message.length).toBeLessThan(160);
  });
});
