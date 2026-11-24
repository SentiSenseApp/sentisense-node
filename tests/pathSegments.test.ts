import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SentiSense, { SentiSenseError } from "../src/index.js";

/**
 * Every caller argument that goes into a request path fills exactly one segment.
 *
 * Each one is percent-encoded, so "/", "?", "#" and "%" cannot move the request to another
 * route. An empty or whitespace-only value, "." and ".." cannot fill a segment at all (URL
 * normalization removes "." and "..", which also reaches another route), so every method
 * refuses them with a `SentiSenseError` naming the method and the argument, before any request.
 *
 * The list of methods is read from the resource sources, so a new method is covered the day it
 * is written, and the source scan below fails if one interpolates an argument any other way.
 */

const RESOURCES = fileURLToPath(new URL("../src/resources/", import.meta.url));

const mockFetch = vi.fn();
const client = new SentiSense({ apiKey: "ssk_test", maxRetries: 0 });

beforeEach(() => vi.stubGlobal("fetch", mockFetch));
afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

function okResponse(): Response {
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
}

function sources(): Array<[string, string]> {
  return readdirSync(RESOURCES)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => [f, readFileSync(RESOURCES + f, "utf8")]);
}

/** Every `pathSegment("resource.method", "arg", ...)` call in the resource sources. */
function pathArguments(): Array<{ resource: string; method: string; arg: string }> {
  const out: Array<{ resource: string; method: string; arg: string }> = [];
  for (const [, text] of sources()) {
    for (const m of text.matchAll(/pathSegment\("(\w+)\.(\w+)", "([\w.]+)"/g)) {
      out.push({ resource: m[1], method: m[2], arg: m[3] });
    }
  }
  return out;
}

/** Parameter names of a method, read from its runtime source. */
function paramNames(fn: (...args: unknown[]) => unknown): string[] {
  const text = fn.toString();
  const open = text.indexOf("(");
  let depth = 0;
  let close = open;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    if (text[i] === ")" && --depth === 0) {
      close = i;
      break;
    }
  }
  return text
    .slice(open + 1, close)
    .split(",")
    .map((p) => p.trim().split(/[\s=:]/)[0])
    .filter((p) => p.length > 0);
}

type Bound = (...args: unknown[]) => Promise<unknown>;

function methodOf(resource: string, method: string): { fn: Bound; params: string[] } {
  const target = (client as unknown as Record<string, Record<string, Bound>>)[resource];
  const fn = target?.[method];
  if (typeof fn !== "function") throw new Error(`no method ${resource}.${method} on the client`);
  return { fn: fn.bind(target), params: paramNames(fn) };
}

const PATH_ARGS = pathArguments();
const PATH_ARG_NAMES = new Set(PATH_ARGS.map((p) => p.arg));

/**
 * Call the method with `value` in `arg`'s slot and a valid value in every other path slot. An
 * `arg` of the form "options.field" is passed as that field of the named parameter.
 */
function callWith(resource: string, method: string, arg: string, value: unknown) {
  const { fn, params } = methodOf(resource, method);
  const [param, field] = arg.split(".");
  expect(params, `${resource}.${method} has no parameter ${param}`).toContain(param);
  const args = params.map((p) =>
    p === param
      ? field === undefined
        ? value
        : { [field]: value }
      : p === "metricType"
        ? "mentions"
        : PATH_ARG_NAMES.has(p)
          ? "AAPL"
          : undefined,
  );
  return fn(...args);
}

describe("path arguments", () => {
  it("finds the methods that put an argument in the path", () => {
    expect(PATH_ARGS.length).toBeGreaterThanOrEqual(56);
    const labels = PATH_ARGS.map((p) => `${p.resource}.${p.method}:${p.arg}`);
    expect(labels).toEqual(expect.arrayContaining(["indexes.get:indexId", "indexes.history:indexId", "trackers.get:trackerId"]));
  });

  it("no resource puts an argument into an API path except through pathSegment", () => {
    const offenders: string[] = [];
    for (const [file, text] of sources()) {
      if (text.includes("encodeURIComponent(")) offenders.push(`${file}: encodeURIComponent`);
      for (const m of text.matchAll(/`(\/api\/[^`]*)`/g)) {
        for (const expr of m[1].matchAll(/\$\{([^}]*)\}/g)) {
          if (!expr[1].startsWith("pathSegment(")) offenders.push(`${file}: ${m[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  const cases = PATH_ARGS.flatMap((p) =>
    ["", "   ", ".", ".."].map((bad) => [`${p.resource}.${p.method}`, p.arg, bad] as const),
  );

  it.each(cases)("%s refuses %s = %j before any request", async (label, arg, bad) => {
    const [resource, method] = label.split(".");
    mockFetch.mockImplementation(async () => okResponse());
    const call = callWith(resource, method, arg, bad);
    await expect(call).rejects.toBeInstanceOf(SentiSenseError);
    await expect(call).rejects.toThrow(
      `${label}: ${arg} must not be empty, "." or ".." (got ${JSON.stringify(bad)})`,
    );
    // A code and no status, so a caller can tell a refused argument from a failed request.
    await expect(call).rejects.toMatchObject({ code: "invalid_argument", status: undefined });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each(PATH_ARGS.map((p) => [`${p.resource}.${p.method}`, p.arg] as const))(
    "%s sends %s as one encoded segment",
    async (label, arg) => {
      const [resource, method] = label.split(".");
      mockFetch.mockImplementation(async () => okResponse());
      await callWith(resource, method, arg, "a/b?c#d%e ..");
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = String(mockFetch.mock.calls[0][0]);
      // The value is upper-cased for some ticker arguments, so match either case.
      expect(url).toMatch(/\/a%2Fb%3Fc%23d%25e%20\.\.(\/|\?|$)/i);
      expect(new URL(url).hash).toBe("");
    },
  );
});

describe("index and tracker ids", () => {
  it("send an ordinary id unchanged", async () => {
    mockFetch.mockImplementation(async () => okResponse());
    await client.indexes.get("fed-sentiment");
    await client.indexes.history("fed-sentiment", 30);
    await client.trackers.get("institution-concentration");
    const paths = mockFetch.mock.calls.map((c) => new URL(String(c[0])));
    expect(paths.map((u) => u.pathname)).toEqual([
      "/api/v1/indexes/fed-sentiment",
      "/api/v1/indexes/fed-sentiment/history",
      "/api/v1/trackers/institution-concentration",
    ]);
    expect(paths[1].search).toBe("?days=30");
  });

  it("cannot reach another route with '..' or '/'", async () => {
    mockFetch.mockImplementation(async () => okResponse());
    await expect(client.indexes.get("..")).rejects.toThrow(/indexes\.get: indexId/);
    await expect(client.trackers.get("../stocks")).resolves.toBeDefined();
    expect(new URL(String(mockFetch.mock.calls[0][0])).pathname).toBe(
      "/api/v1/trackers/..%2Fstocks",
    );
  });
});
