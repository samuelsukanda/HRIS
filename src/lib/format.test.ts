import { describe, expect, it } from "vitest";
import { fmtDateLongID, fmtDateRangeID, inclusiveDays, isCalendarDate } from "./format";

describe("date validation", () => {
  it("accepts real calendar dates only", () => {
    expect(isCalendarDate("2026-02-28")).toBe(true);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("not-a-date")).toBe(false);
  });

  it("calculates inclusive days without string loops", () => {
    expect(inclusiveDays("2026-09-25", "2026-09-30")).toBe(6);
    expect(inclusiveDays("2026-09-30", "2026-09-25")).toBe(0);
    expect(inclusiveDays("bad", "2026-09-25")).toBe(0);
  });
});
describe("fmtDateRangeID", () => {
  it("rentang dengan hari di tanggal mulai", () => {
    expect(fmtDateRangeID("2026-09-25", "2026-09-30")).toBe("Jum, 25 Sep - 30 Sep 2026");
  });
  it("hari yang sama", () => {
    expect(fmtDateRangeID("2026-09-25", "2026-09-25")).toBe("Jum, 25 Sep 2026");
  });
});

describe("fmtDateLongID", () => {
  it("format ISO date string", () => {
    expect(fmtDateLongID("2026-09-25")).toBe("25 September 2026");
  });
  it("format Date object (hasil query PG)", () => {
    expect(fmtDateLongID(new Date(2026, 8, 25))).toBe("25 September 2026");
  });
});
