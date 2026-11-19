import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import SentiSense, {
  type CalendarListResponse,
  type CalendarListing,
  type GetEarningsCalendarOptions,
} from "../../src/index.js";

/** The calendar discovery list. The fixture is a live response. */

const mockFetch = vi.fn();
const client = new SentiSense({ apiKey: "ssk_test" });

beforeEach(() => vi.stubGlobal("fetch", mockFetch));
afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

function respond(payload: unknown) {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const LIST = JSON.parse(
  readFileSync(fileURLToPath(new URL("../fixtures/calendar_list_live.json", import.meta.url)), "utf8"),
) as CalendarListResponse;

const LISTING_KEYS = { type: true, path: true, description: true } satisfies Record<keyof CalendarListing, true>;

describe("calendar.list", () => {
  it("calls the calendar root with no query", async () => {
    respond(LIST);
    await client.calendar.list();
    const url = new URL(String(mockFetch.mock.calls[0][0]));
    expect(url.pathname).toBe("/api/v1/calendar");
    expect(url.search).toBe("");
  });

  it("returns the calendars with their paths, with no preview envelope", async () => {
    respond(LIST);
    const result = await client.calendar.list();
    expectTypeOf(result.calendars).toEqualTypeOf<CalendarListing[]>();
    expect(result).toEqual(LIST);
    const earnings = result.calendars.find((c) => c.type === "earnings");
    expect(earnings?.path).toBe("/api/v1/calendar/earnings");
  });

  it("declares every key the wire sends, and the wire sends every declared key", () => {
    expect(Object.keys(LIST)).toEqual(["calendars"]);
    for (const listing of LIST.calendars) {
      expect(Object.keys(listing).sort()).toEqual(Object.keys(LISTING_KEYS).sort());
    }
  });
});

describe("calendar.getEarnings week", () => {
  const EMPTY = {
    isPreview: false,
    previewReason: null,
    data: { earnings: [], metadata: { generatedAt: null, windowStart: "2026-11-09", windowEnd: "2026-11-15", count: 0, source: "sentisense" } },
  };

  it("takes the three documented shorthands, last week included", () => {
    expectTypeOf<GetEarningsCalendarOptions["week"]>().toEqualTypeOf<"this" | "next" | "last" | undefined>();
  });

  it("sends week=last as given", async () => {
    respond(EMPTY);
    await client.calendar.getEarnings({ week: "last" });
    const url = new URL(String(mockFetch.mock.calls[0][0]));
    expect(url.pathname).toBe("/api/v1/calendar/earnings");
    expect(url.searchParams.get("week")).toBe("last");
  });
});
