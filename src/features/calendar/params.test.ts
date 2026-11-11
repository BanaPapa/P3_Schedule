import { describe, expect, it } from "vitest";
import { calendarHref, calendarRange, groupByDate, parseCalendarParams, shiftCalendar } from "./params";

const TODAY = "2026-11-04";
const CHILD = "6f1c2f0e-8f43-4c1e-9d55-3f0f6c2f9a11";

describe("parseCalendarParams", () => {
  it("defaults to this week and today", () => {
    expect(parseCalendarParams({}, TODAY)).toEqual({ view: "week", date: TODAY, childId: null });
  });

  it("reads view, date and child", () => {
    expect(parseCalendarParams({ view: "month", date: "2026-12-01", child: CHILD }, TODAY)).toEqual({
      view: "month",
      date: "2026-12-01",
      childId: CHILD,
    });
  });

  it("ignores invalid values and repeated params", () => {
    expect(
      parseCalendarParams({ view: "year", date: "2026-02-30", child: "x' or 1=1" }, TODAY),
    ).toEqual({ view: "week", date: TODAY, childId: null });
    expect(parseCalendarParams({ view: ["month", "week"] }, TODAY).view).toBe("week");
  });

  it("does not go further than a year ahead", () => {
    expect(parseCalendarParams({ date: "2028-01-01" }, TODAY).date).toBe("2027-11-04");
  });
});

describe("calendarRange", () => {
  it("covers the whole month grid", () => {
    expect(calendarRange({ view: "month", date: "2026-11-18", childId: null })).toEqual({
      from: "2026-10-26",
      to: "2026-12-06",
    });
  });

  it("covers Monday to Sunday for a week", () => {
    expect(calendarRange({ view: "week", date: "2026-11-04", childId: null })).toEqual({
      from: "2026-11-02",
      to: "2026-11-08",
    });
  });

  it("covers the same week for the table view", () => {
    expect(calendarRange({ view: "table", date: "2026-11-04", childId: null })).toEqual({
      from: "2026-11-02",
      to: "2026-11-08",
    });
  });
});

describe("table view", () => {
  it("reads view=table", () => {
    expect(parseCalendarParams({ view: "table" }, TODAY).view).toBe("table");
  });

  it("moves by a week and keeps view=table in the link", () => {
    const next = shiftCalendar({ view: "table", date: "2026-11-04", childId: null }, 1);
    expect(next).toEqual({ view: "table", date: "2026-11-11", childId: null });
    expect(calendarHref(next, TODAY)).toBe("/calendar?view=table&date=2026-11-11");
  });
});

describe("shiftCalendar", () => {
  it("moves a month view to the first day of the next or previous month", () => {
    expect(shiftCalendar({ view: "month", date: "2026-11-18", childId: null }, 1).date).toBe("2026-12-01");
    expect(shiftCalendar({ view: "month", date: "2026-01-31", childId: null }, -1).date).toBe("2025-12-01");
  });

  it("moves a week view by seven days", () => {
    expect(shiftCalendar({ view: "week", date: "2026-11-04", childId: CHILD }, -1)).toEqual({
      view: "week",
      date: "2026-10-28",
      childId: CHILD,
    });
  });
});

describe("calendarHref", () => {
  it("omits defaults", () => {
    expect(calendarHref({ view: "week", date: TODAY, childId: null }, TODAY)).toBe("/calendar");
  });

  it("keeps non-default values", () => {
    expect(calendarHref({ view: "month", date: "2026-11-10", childId: CHILD }, TODAY)).toBe(
      `/calendar?view=month&date=2026-11-10&child=${CHILD}`,
    );
  });
});

describe("groupByDate", () => {
  it("groups items by their date in order", () => {
    const groups = groupByDate([
      { date: "2026-11-03", id: "a" },
      { date: "2026-11-05", id: "b" },
      { date: "2026-11-03", id: "c" },
    ]);
    expect(groups.get("2026-11-03")?.map((item) => item.id)).toEqual(["a", "c"]);
    expect(groups.get("2026-11-05")?.map((item) => item.id)).toEqual(["b"]);
    expect(groups.get("2026-11-04")).toBeUndefined();
  });
});
