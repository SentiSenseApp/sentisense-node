import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense from "../../src/index.js";
import type { EntitySearchResult } from "../../src/index.js";

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

describe("kb.searchEntities", () => {
  it("calls GET /api/v1/kb/entities/search with the query", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.kb.searchEntities("Tesla");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/kb/entities/search");
    expect(url).toContain("q=Tesla");
  });

  it("forwards the type and limit filters", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    await client.kb.searchEntities("Musk", { type: "person", limit: 5 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("type=person");
    expect(url).toContain("limit=5");
  });

  it("returns a bare array, not a preview envelope", async () => {
    const hit: EntitySearchResult = {
      name: "Tesla, Inc.",
      urlSlug: "tesla",
      type: "company",
      ticker: "TSLA",
    };
    mockFetch.mockResolvedValueOnce(jsonResponse([hit]));
    const results = await client.kb.searchEntities("Tesla");
    expect(Array.isArray(results)).toBe(true);
    expect(results[0].ticker).toBe("TSLA");
    expect(results[0].urlSlug).toBe("tesla");
  });

  it("reads an entity with no ticker without inventing one", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ name: "Elon Musk", urlSlug: "elon-musk", type: "person", ticker: null }]),
    );
    const results = await client.kb.searchEntities("Elon Musk");
    expect(results[0].ticker).toBeNull();
    expect(results[0].type).toBe("person");
  });
});
