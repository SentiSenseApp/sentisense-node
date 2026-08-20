import { describe, expect, it } from "vitest";
import {
  GLOBAL_FLAGS,
  editDistance,
  nearest,
  parseArgs,
  splitCommand,
  type FlagSpecs,
} from "../../src/cli/parse.js";
import { CliUsageError } from "../../src/cli/errors.js";

const SPECS: FlagSpecs = {
  ...GLOBAL_FLAGS,
  days: { type: "number", describe: "days" },
  filter: { type: "string", repeat: true, describe: "filter" },
  list: { type: "boolean", describe: "list" },
};

describe("splitCommand", () => {
  it("takes the command from the first position only", () => {
    expect(splitCommand(["quote", "NVDA", "--json"])).toEqual({
      command: "quote",
      rest: ["NVDA", "--json"],
    });
  });

  it("treats a leading flag as no command", () => {
    expect(splitCommand(["--version"])).toEqual({ rest: ["--version"] });
  });

  it("does not mistake a flag value for the command", () => {
    // The whole reason the command is positional: scanning for "first non-flag token" reads
    // the key here.
    expect(splitCommand(["--api-key", "ssk_x", "quote"])).toEqual({
      rest: ["--api-key", "ssk_x", "quote"],
    });
  });

  it("returns nothing for an empty argv", () => {
    expect(splitCommand([])).toEqual({ rest: [] });
  });
});

describe("parseArgs", () => {
  it("collects positionals and switches", () => {
    const args = parseArgs(["NVDA", "AAPL", "--json", "--full"], SPECS);
    expect(args.positionals).toEqual(["NVDA", "AAPL"]);
    expect(args.flags.json).toBe(true);
    expect(args.flags.full).toBe(true);
  });

  it("reads a value flag as both --key value and --key=value", () => {
    expect(parseArgs(["--days", "90"], SPECS).flags.days).toBe(90);
    expect(parseArgs(["--days=90"], SPECS).flags.days).toBe(90);
  });

  it("collects a repeatable flag into an array", () => {
    const args = parseArgs(["--filter", "A:GTE:1", "--filter", "B:LTE:2"], SPECS);
    expect(args.flags.filter).toEqual(["A:GTE:1", "B:LTE:2"]);
  });

  it("expands the short forms of help and version", () => {
    expect(parseArgs(["-h"], SPECS).flags.help).toBe(true);
    expect(parseArgs(["-v"], SPECS).flags.version).toBe(true);
  });

  it("rejects an unknown flag and suggests the nearest real one", () => {
    try {
      parseArgs(["--dayz", "3"], SPECS);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(CliUsageError);
      expect((error as CliUsageError).message).toContain('unknown flag "--dayz"');
      expect((error as CliUsageError).hint).toContain("--days");
    }
  });

  it("rejects a value flag with nothing after it", () => {
    expect(() => parseArgs(["--days"], SPECS)).toThrow(CliUsageError);
    expect(() => parseArgs(["--days", "--json"], SPECS)).toThrow(CliUsageError);
  });

  it("rejects a non-numeric value for a number flag", () => {
    expect(() => parseArgs(["--days", "soon"], SPECS)).toThrow(/expects a number/);
  });

  it("rejects a value attached to a switch", () => {
    expect(() => parseArgs(["--list=7"], SPECS)).toThrow(/takes no value/);
  });

  it("reads --list=false as off", () => {
    expect(parseArgs(["--list=false"], SPECS).flags.list).toBe(false);
  });

  it("passes everything after -- through as positionals", () => {
    const args = parseArgs(["NVDA", "--", "--json"], SPECS);
    expect(args.positionals).toEqual(["NVDA", "--json"]);
    expect(args.flags.json).toBeUndefined();
  });

  it("keeps a negative number as a positional", () => {
    expect(parseArgs(["-5"], SPECS).positionals).toEqual(["-5"]);
  });
});

describe("nearest", () => {
  it("finds a one-character typo", () => {
    expect(nearest("quotes", ["quote", "mood", "news"])).toBe("quote");
  });

  it("gives up when nothing is close", () => {
    expect(nearest("wxyz", ["quote", "mood"])).toBeUndefined();
  });

  it("measures edit distance", () => {
    expect(editDistance("quote", "quote")).toBe(0);
    expect(editDistance("quote", "quotes")).toBe(1);
    expect(editDistance("", "abc")).toBe(3);
  });
});
