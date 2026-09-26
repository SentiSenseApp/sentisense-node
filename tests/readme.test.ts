import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The README's "Response shapes" section tells a reader which methods return the
 * `{ isPreview, previewReason, data }` envelope, so that a caller reaches for `result.data`
 * rather than the response itself. That list used to be hand-maintained, and it drifted:
 * two consecutive SDK reviews found it naming 8 methods while the declared types carried
 * the envelope on 33. TypeScript callers are covered by the return types either way, so
 * nothing failed and the drift survived a prose fix.
 *
 * This derives the list from the source signatures instead and fails when the README falls
 * behind, in either direction. Add a method returning `PreviewResponse<T>` and this test
 * names it until the table does too.
 */

const repoRoot = new URL("../", import.meta.url);
const resourcesDir = fileURLToPath(new URL("src/resources/", repoRoot));

/** Map each resource class to the property it is exposed as on the client. */
function namespaceByClass(): Map<string, string> {
  const source = readFileSync(fileURLToPath(new URL("src/client.ts", repoRoot)), "utf8");
  const map = new Map<string, string>();
  for (const match of source.matchAll(/this\.([A-Za-z_$][\w$]*)\s*=\s*new\s+([A-Za-z_$][\w$]*)\(/g)) {
    map.set(match[2], match[1]);
  }
  return map;
}

/**
 * Every public method whose declared return type is `Promise<PreviewResponse<...>>`, as
 * `namespace.method`. Signatures wrap across lines, so each candidate accumulates until the
 * line that opens the body.
 */
function envelopeMethodsFromSource(): string[] {
  const namespaces = namespaceByClass();
  const found: string[] = [];

  for (const file of readdirSync(resourcesDir).filter((name) => name.endsWith(".ts")).sort()) {
    const lines = readFileSync(`${resourcesDir}${file}`, "utf8").split("\n");
    let className: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const classMatch = lines[i].match(/^export class ([A-Za-z_$][\w$]*)/);
      if (classMatch) {
        className = classMatch[1];
        continue;
      }
      if (/^ {2}(?:private|protected|constructor)\b/.test(lines[i])) continue;

      const methodMatch = lines[i].match(/^ {2}(?:public\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/);
      if (!methodMatch || className === null) continue;

      let signature = lines[i];
      for (let j = i + 1; j < lines.length && j < i + 20 && !/\{\s*$/.test(signature); j++) {
        signature += `\n${lines[j]}`;
      }
      if (!/Promise<\s*PreviewResponse</.test(signature)) continue;

      found.push(`${namespaces.get(className) ?? className}.${methodMatch[1]}`);
    }
  }

  return found;
}

/** The methods the README's envelope table names, as `namespace.method`. */
function envelopeMethodsFromReadme(): string[] {
  const readme = readFileSync(fileURLToPath(new URL("README.md", repoRoot)), "utf8");
  const start = readme.indexOf("**1. Tier-gated endpoints return a preview envelope.**");
  const end = readme.indexOf("**2. Document endpoints return a search wrapper.**");
  expect(start, "README is missing the preview-envelope section").toBeGreaterThan(-1);
  expect(end, "README is missing the document-wrapper section").toBeGreaterThan(start);

  const section = readme.slice(start, end);
  const named: string[] = [];
  for (const row of section.matchAll(/^\|\s*`([A-Za-z_$][\w$]*)`\s*\|(.+?)\|\s*$/gm)) {
    for (const method of row[2].matchAll(/`([A-Za-z_$][\w$]*)`/g)) {
      named.push(`${row[1]}.${method[1]}`);
    }
  }
  return named;
}

describe("README preview-envelope table", () => {
  const fromSource = envelopeMethodsFromSource();
  const fromReadme = envelopeMethodsFromReadme();

  it("finds the envelope methods in the source", () => {
    // Guards the parser itself: an extraction that silently matched nothing would make
    // every assertion below pass for the wrong reason.
    expect(fromSource.length).toBeGreaterThan(20);
    expect(fromSource).toContain("institutional.getFlows");
    expect(fromSource).toContain("stocks.getOptionsSummary");
  });

  it("names every method that returns a preview envelope", () => {
    const missing = fromSource.filter((method) => !fromReadme.includes(method)).sort();
    expect(missing, `README envelope table is missing: ${missing.join(", ")}`).toEqual([]);
  });

  it("names no method that does not return one", () => {
    const stale = fromReadme.filter((method) => !fromSource.includes(method)).sort();
    expect(stale, `README envelope table names non-enveloped methods: ${stale.join(", ")}`).toEqual(
      [],
    );
  });
});

/**
 * A distribution answers a count metric with percentage shares and `sentiment` with per-source
 * means, and names which in `valueType`. `sentisense_score` has no per-source split and answers
 * empty, so a README example that passes it shows a call that returns nothing.
 */
describe("README getDistribution examples", () => {
  const readme = readFileSync(fileURLToPath(new URL("README.md", repoRoot)), "utf8");
  const calls = [...readme.matchAll(/getDistribution\(\s*"[^"]*"\s*,\s*"([^"]+)"/g)].map((m) => m[1]);

  it("finds the examples", () => {
    expect(calls.length).toBeGreaterThan(0);
  });

  it("only passes metrics that have a per-source split", () => {
    const empty = calls.filter(
      (metric) => !["mentions", "creators", "app_review_count", "sentiment"].includes(metric),
    );
    expect(empty, `README shows getDistribution with a metric that answers empty: ${empty.join(", ")}`).toEqual([]);
  });

  it("names both value types", () => {
    expect(readme).toContain('"SHARE_PERCENT"');
    expect(readme).toContain('"MEAN"');
  });
});
