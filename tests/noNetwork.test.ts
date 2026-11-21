import { describe, expect, it } from "vitest";
import SentiSense, { SentiSenseError } from "../src/index.js";

/**
 * Proves the suite cannot reach the network: with no stub in place, a client call fails on the
 * guard installed by `tests/setup/noNetwork.ts` and nothing is sent.
 *
 * Each test checks for the guard before it calls anything, so if the setup file were ever
 * dropped from `vitest.config.ts` these tests fail without sending a request to the live API.
 */

const MARKER = Symbol.for("sentisense.tests.noNetwork");
const BLOCKED = Symbol.for("sentisense.tests.blockedRequests");

function guardInstalled(): boolean {
  return (globalThis.fetch as unknown as Record<symbol, unknown>)[MARKER] === true;
}

function blockedRequests(): string[] {
  return (globalThis as Record<symbol, unknown>)[BLOCKED] as string[];
}

describe("no network in tests", () => {
  it("the global fetch is the guard", () => {
    expect(guardInstalled()).toBe(true);
    expect(Array.isArray(blockedRequests())).toBe(true);
  });

  it("an unstubbed client call fails on the guard, is recorded, and is not sent", async () => {
    expect(guardInstalled()).toBe(true);
    const client = new SentiSense({ apiKey: "ssk_test", maxRetries: 0 });
    const error = await client.stocks.getQuote("AAPL").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SentiSenseError);
    expect((error as Error).message).toMatch(/Tests may not reach the network/);
    expect(blockedRequests()).toEqual(["https://app.sentisense.ai/api/v1/stocks/AAPL/quote"]);
    // Cleared here because this test makes the attempt on purpose; any other test that leaves
    // an entry behind fails in the guard's afterEach.
    blockedRequests().splice(0);
  });
});
