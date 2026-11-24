import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/**
 * Every field the API docs list is declared on the matching type.
 *
 * `tests/fixtures/documented_fields.json` holds a copy of the field names in the docs' response
 * tables. This test reads the interfaces in `src/` and fails when a documented field is not
 * declared, when a declared field is not documented (a typed field is a public promise, and an
 * undocumented one is usually a second name for a documented value), or when the list of known
 * gaps below is out of date. When the docs gain a field, update the fixture, then declare it.
 */

const repoRoot = new URL("../", import.meta.url);

interface DocumentedEndpoint {
  endpoint: string;
  page: string;
  tables: Record<string, string[]>;
}

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("tests/fixtures/documented_fields.json", repoRoot)), "utf8"),
) as { endpoints: DocumentedEndpoint[] };

/** The interface each documented table is declared by. */
const TYPE_FOR_TABLE: Record<string, Record<string, string>> = {
  "GET /api/v1/analyst/{ticker}/estimates": {
    data: "AnalystEstimatesResponse",
    "estimates[]": "AnalystEstimate",
    "surprises[]": "AnalystEarningsSurprise",
  },
  "GET /api/v2/metrics/entity/{entityId}/event-counts": {
    data: "EventCounts",
    "categories[]": "EventCategory",
    "days[]": "EventCountsDay",
  },
  "GET /api/v2/metrics/entity/{entityId}/headline-scores": {
    data: "HeadlineScores",
    "scores[]": "HeadlineScore",
    "levels[]": "HeadlineScoreLevel",
    "days[]": "HeadlineScoresDay",
    "days[].scores.<key>": "HeadlineScoreCounts",
  },
};

/**
 * Documented fields not declared yet. Callers can still read them, since responses pass every
 * key through. Remove a name here when you declare it; the test fails until you do.
 */
const NOT_YET_DECLARED: Record<string, Record<string, string[]>> = {
  "GET /api/v1/analyst/{ticker}/estimates": {
    "surprises[]": ["surpriseFlag"],
  },
};

/** Exported interfaces in `src/types.ts` and `src/resources/*.ts`, by name. */
function readInterfaces(): Map<string, ts.InterfaceDeclaration> {
  const files = [
    "src/types.ts",
    ...readdirSync(fileURLToPath(new URL("src/resources/", repoRoot)))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => `src/resources/${f}`),
  ];
  const found = new Map<string, ts.InterfaceDeclaration>();
  for (const file of files) {
    const source = readFileSync(fileURLToPath(new URL(file, repoRoot)), "utf8");
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    for (const statement of sf.statements) {
      if (ts.isInterfaceDeclaration(statement)) found.set(statement.name.text, statement);
    }
  }
  return found;
}

const interfaces = readInterfaces();

/** Named properties of an interface and the interfaces it extends; index signatures excluded. */
function declaredFields(name: string): Set<string> {
  const decl = interfaces.get(name);
  if (!decl) throw new Error(`interface ${name} not found in src/`);
  const fields = new Set<string>();
  for (const member of decl.members) {
    if (ts.isPropertySignature(member) && member.name) {
      fields.add(member.name.getText().replace(/^["']|["']$/g, ""));
    }
  }
  for (const clause of decl.heritageClauses ?? []) {
    for (const base of clause.types) {
      const baseName = base.expression.getText();
      if (interfaces.has(baseName)) for (const f of declaredFields(baseName)) fields.add(f);
    }
  }
  return fields;
}

const cases = fixture.endpoints.flatMap((e) =>
  Object.entries(e.tables).map(([table, documented]) => ({ endpoint: e.endpoint, table, documented })),
);

describe("documented fields are declared", () => {
  it("the fixture lists at least one table", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases)("$endpoint $table", ({ endpoint, table, documented }) => {
    const typeName = TYPE_FOR_TABLE[endpoint]?.[table];
    expect(typeName, `map ${endpoint} ${table} to its interface in TYPE_FOR_TABLE`).toBeTruthy();
    const declared = declaredFields(typeName!);
    const gaps = NOT_YET_DECLARED[endpoint]?.[table] ?? [];

    const missing = documented.filter((f) => !declared.has(f) && !gaps.includes(f));
    expect(missing, `documented on ${endpoint} ${table} but not declared on ${typeName}`).toEqual([]);

    const undocumented = [...declared].filter((f) => !documented.includes(f));
    expect(undocumented, `declared on ${typeName} but not in the docs table`).toEqual([]);

    const nowDeclared = gaps.filter((f) => declared.has(f));
    expect(nowDeclared, `declared on ${typeName}: remove from NOT_YET_DECLARED`).toEqual([]);

    const notDocumented = gaps.filter((f) => !documented.includes(f));
    expect(notDocumented, `NOT_YET_DECLARED lists fields the docs do not`).toEqual([]);
  });

  it("every known gap names a table in the fixture", () => {
    for (const [endpoint, tables] of Object.entries(NOT_YET_DECLARED)) {
      for (const table of Object.keys(tables)) {
        expect(cases.some((c) => c.endpoint === endpoint && c.table === table), `${endpoint} ${table}`).toBe(true);
      }
    }
  });
});
