import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  formatDayLabel,
  formatMonthLabel,
  formatRelative,
  formatTime,
  isIsoDate,
  isoWeekday,
  monthBounds,
  monthGrid,
  parseMonth,
  todayInSeoul,
  weekDates,
} from "./dates";

describe("isIsoDate", () => {
  it.each(["2026-11-03", "2024-02-29"])("accepts %s", (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each(["2026-02-29", "2026-13-01", "2026-1-3", "20261103", ""])("rejects %s", (value) => {
    expect(isIsoDate(value)).toBe(false);
  });
});

describe("todayInSeoul", () => {
  it("uses the Seoul date, not UTC", () => {
    // 2026-10-31 16:30 UTC = 2026-11-01 01:30 KST
    expect(todayInSeoul(new Date("2026-10-31T16:30:00Z"))).toBe("2026-11-01");
  });
});

describe("addDays / isoWeekday", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("numbers weekdays Monday=1 … Sunday=7", () => {
    expect(isoWeekday("2026-11-02")).toBe(1);
    expect(isoWeekday("2026-11-08")).toBe(7);
  });
});

describe("weekDates", () => {
  it("returns Monday through Sunday around the date", () => {
    expect(weekDates("2026-11-04")).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
  });

  it("treats Monday as the first day and Sunday as the last", () => {
    expect(weekDates("2026-11-09")[0]).toBe("2026-11-09");
    expect(weekDates("2026-11-08")[0]).toBe("2026-11-02");
  });
});

describe("months", () => {
  it("parses YYYY-MM and rejects junk", () => {
    expect(parseMonth("2026-11")).toEqual({ year: 2026, month: 11 });
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth("nope")).toBeNull();
    expect(parseMonth(undefined)).toBeNull();
  });

  it("adds months across years", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("gives first and last day", () => {
    expect(monthBounds({ year: 2026, month: 2 })).toEqual({ first: "2026-02-01", last: "2026-02-28" });
  });

  it("builds a Monday-first grid of whole weeks", () => {
    const grid = monthGrid({ year: 2026, month: 11 });
    expect(grid).toHaveLength(6);
    expect(grid[0][0]).toBe("2026-10-26");
    expect(grid.at(-1)?.at(-1)).toBe("2026-12-06");
    expect(grid.every((week) => week.length === 7)).toBe(true);
  });

  it("pads the first week with the previous month", () => {
    expect(monthGrid({ year: 2026, month: 12 })[0][0]).toBe("2026-11-30");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-11-04T12:00:00+09:00");
  it.each([
    ["2026-11-04T11:59:40+09:00", "방금"],
    ["2026-11-04T11:55:00+09:00", "5분 전"],
    ["2026-11-04T09:00:00+09:00", "3시간 전"],
    ["2026-11-03T20:00:00+09:00", "어제 20:00"],
    ["2026-11-01T08:05:00+09:00", "11월 1일 08:05"],
  ])("%s → %s", (iso, expected) => {
    expect(formatRelative(iso, now)).toBe(expected);
  });
});

describe("formatting", () => {
  it("formats times, months and days in Korean", () => {
    expect(formatTime("16:00:00")).toBe("16:00");
    expect(formatTime("09:05")).toBe("09:05");
    expect(formatMonthLabel({ year: 2026, month: 11 })).toBe("2026년 11월");
    expect(formatDayLabel("2026-11-03")).toBe("11월 3일 (화)");
  });
});
