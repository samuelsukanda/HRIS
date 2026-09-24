import { describe, expect, it } from "vitest";
import { fmtDateLongID, fmtDateRangeID, fmtDateTimeLongID } from "./format";

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

describe("fmtDateTimeLongID", () => {
  it("format Date dengan jam", () => {
    expect(fmtDateTimeLongID(new Date(2025, 8, 25, 18, 0))).toBe("25 September 2025 18:00");
  });
  it("format ISO timestamp", () => {
    const d = new Date(2026, 0, 1, 9, 5);
    expect(fmtDateTimeLongID(d.toISOString())).toBe("1 Januari 2026 09:05");
  });
});
