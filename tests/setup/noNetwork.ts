import { afterEach } from "vitest";

/**
 * The test suite never reaches the network.
 *
 * Loaded before every test file (see `vitest.config.ts`). It replaces the global `fetch` with
 * one that throws, so a test that forgets to stub `fetch` fails instead of sending a request to
 * the live API. `vi.stubGlobal("fetch", ...)` still works as before, and `vi.unstubAllGlobals()`
 * restores this guard, not the real `fetch`.
 *
 * The client turns a failed fetch into a `SentiSenseError`, which a test expecting an error
 * could accept. So every blocked request is also recorded, and the test that made it fails
 * afterwards whatever it asserted.
 */

export const NO_NETWORK_MARKER = Symbol.for("sentisense.tests.noNetwork");
export const BLOCKED_REQUESTS = Symbol.for("sentisense.tests.blockedRequests");

const blocked: string[] = [];
(globalThis as Record<symbol, unknown>)[BLOCKED_REQUESTS] = blocked;

const blockedFetch = async (input: unknown): Promise<Response> => {
  const url = String(input).slice(0, 120);
  blocked.push(url);
  throw new Error(
    `Tests may not reach the network (requested ${url}). ` +
      `Stub fetch with vi.stubGlobal("fetch", ...) in this test.`,
  );
};
Object.defineProperty(blockedFetch, NO_NETWORK_MARKER, { value: true });

globalThis.fetch = blockedFetch as typeof fetch;

afterEach(() => {
  if (blocked.length === 0) return;
  const urls = blocked.splice(0);
  throw new Error(`This test tried to reach the network: ${urls.join(", ")}`);
});
