import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/**
 * One value gets one name. A field whose comment says it carries the "same value as" another
 * field, or is an "alias of" or "alias for" one, is a second name for a value the type already
 * declares, and every typed field is a public promise.
 *
 * This reads the comments attached to the fields of every exported interface and object type in
 * `src/types.ts` and `src/resources/*.ts`, and fails on that wording. Wording that is not a second
 * field name, and duplicates that were published before this check, are listed in ALLOWED with
 * the reason for each.
 */

const repoRoot = new URL("../", import.meta.url);

const DUPLICATE_WORDING = /same value as|alias (?:of|for)\b/i;

/** `"<file> <Type>.<field>"` mapped to why the wording is allowed on that field. */
const ALLOWED: Record<string, string> = {
  "src/types.ts GetChartOptions.timeframe":
    'Describes the request value "ALL", accepted as "5Y": a value note, not a second field name.',
  "src/resources/etfs.ts EtfHolding.localTicker":
    "Published and documented beside `ticker`; kept so existing callers keep working.",
};

interface Finding {
  key: string;
  line: number;
  comment: string;
}

/** Field comments in exported interfaces and object types that use the duplicate wording. */
function findDuplicateWording(file: string, source: string): Finding[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings: Finding[] = [];

  const isExported = (node: ts.Node) =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

  const pathOf = (member: ts.Node): string => {
    const parts: string[] = [];
    for (let n: ts.Node | undefined = member; n; n = n.parent) {
      if ((ts.isPropertySignature(n) || ts.isMethodSignature(n)) && n.name) parts.unshift(n.name.getText(sf));
      if (ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) {
        parts.unshift(n.name.text);
        break;
      }
    }
    return parts.join(".");
  };

  const check = (member: ts.Node) => {
    const ranges = [
      ...(ts.getLeadingCommentRanges(source, member.getFullStart()) ?? []),
      ...(ts.getTrailingCommentRanges(source, member.getEnd()) ?? []),
    ];
    for (const range of ranges) {
      // Join wrapped JSDoc lines so a phrase split across two lines is still found.
      const comment = source
        .slice(range.pos, range.end)
        .replace(/\n\s*\*(?!\/)/g, " ")
        .replace(/\s+/g, " ");
      if (DUPLICATE_WORDING.test(comment)) {
        const line = sf.getLineAndCharacterOfPosition(range.pos).line + 1;
        findings.push({ key: `${file} ${pathOf(member)}`, line, comment });
      }
    }
  };

  const visit = (node: ts.Node) => {
    node.forEachChild((child) => {
      if (ts.isPropertySignature(child) || ts.isMethodSignature(child)) check(child);
      visit(child);
    });
  };

  for (const statement of sf.statements) {
    if ((ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) && isExported(statement)) {
      visit(statement);
    }
  }
  return findings;
}

function scanSources(): Finding[] {
  const files = [
    "src/types.ts",
    ...readdirSync(fileURLToPath(new URL("src/resources/", repoRoot)))
      .filter((name) => name.endsWith(".ts"))
      .sort()
      .map((name) => `src/resources/${name}`),
  ];
  return files.flatMap((file) =>
    findDuplicateWording(file, readFileSync(fileURLToPath(new URL(file, repoRoot)), "utf8")),
  );
}

describe("one value, one name", () => {
  it("no field comment describes a second name for a value", () => {
    const offending = scanSources().filter((finding) => !(finding.key in ALLOWED));
    const listed = offending.map((f) => `  ${f.key} (line ${f.line}): ${f.comment}`).join("\n");
    expect(
      offending,
      "One value gets one name. These field comments describe a second name for a value another " +
        `field already carries:\n${listed}\n` +
        "Type the value once, under the name the API docs use. If a duplicate is really wanted, " +
        "add it to ALLOWED in this test deliberately, with a one-line reason.",
    ).toEqual([]);
  });

  it("every ALLOWED entry still matches a field comment", () => {
    const found = new Set(scanSources().map((finding) => finding.key));
    const stale = Object.keys(ALLOWED).filter((key) => !found.has(key));
    expect(stale, `Remove these ALLOWED entries, nothing matches them any more: ${stale.join(", ")}`).toEqual([]);
  });

  it("reads field comments only, including trailing and wrapped ones", () => {
    const fixture = [
      "/** Kept as an alias of the inner shape. */",
      "export type Old = Row;",
      "export interface Row {",
      "  /** Same value as `id`. */",
      "  rowId: string;",
      "  nested: {",
      "    /** An alias",
      "     * for `id`. */",
      "    key: string;",
      "  };",
      "  other: string; // alias of id",
      "  /** The legacy value. */",
      "  fine: string;",
      "}",
      "interface Internal {",
      "  /** Same value as `id`. */",
      "  hidden: string;",
      "}",
    ].join("\n");
    const keys = findDuplicateWording("fixture.ts", fixture).map((f) => f.key).sort();
    expect(keys).toEqual(["fixture.ts Row.nested.key", "fixture.ts Row.other", "fixture.ts Row.rowId"]);
  });
});
