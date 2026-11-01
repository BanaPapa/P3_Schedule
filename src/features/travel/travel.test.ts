import { describe, expect, it } from "vitest";
import { CATEGORY_LABELS, tripDayNumber, tripDays, tripStatusLabel } from "./format";
import { budgetSchema, expenseSchema, itemSchema, tripCreateSchema } from "./schemas";

const UUID = "6f1c2f0e-8f43-4c1e-9d55-3f0f6c2f9a11";

describe("travel format", () => {
  it("lists every day of the trip", () => {
    expect(tripDays("2027-07-30", "2027-08-02")).toEqual(["2027-07-30", "2027-07-31", "2027-08-01", "2027-08-02"]);
  });

  it("numbers trip days from 1", () => {
    expect(tripDayNumber("2027-07-20", "2027-07-22")).toBe(3);
  });

  it.each([
    ["2027-07-08", "D-12"],
    ["2027-07-19", "D-1"],
    ["2027-07-21", "여행 중 · 2일차"],
    ["2027-07-24", "다녀옴"],
  ])("today %s → %s", (today, expected) => {
    expect(tripStatusLabel(today, "2027-07-20", "2027-07-23")).toBe(expected);
  });

  it("labels every category in Korean", () => {
    expect(Object.values(CATEGORY_LABELS)).toEqual(["교통", "숙박", "식비", "관광·체험", "쇼핑", "기타"]);
  });
});

describe("travel schemas", () => {
  it("parses a trip with an optional budget", () => {
    expect(
      tripCreateSchema.parse({
        title: " 제주 여행 ",
        destination: "제주",
        startDate: "2027-07-20",
        endDate: "2027-07-23",
        budgetAmount: "1,500,000",
        memo: "",
      }),
    ).toEqual({
      title: "제주 여행",
      destination: "제주",
      startDate: "2027-07-20",
      endDate: "2027-07-23",
      budgetAmount: 1500000,
      memo: null,
    });
  });

  it.each([
    [{ endDate: "2027-07-19" }, "endDate"],
    [{ endDate: "2027-10-01" }, "endDate"],
    [{ title: " " }, "title"],
  ])("rejects trips with %j", (overrides, field) => {
    const result = tripCreateSchema.safeParse({
      title: "제주",
      destination: "",
      startDate: "2027-07-20",
      endDate: "2027-07-23",
      budgetAmount: "",
      memo: "",
      ...overrides,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });

  it("parses itinerary items with optional times", () => {
    expect(
      itemSchema.parse({
        tripId: UUID,
        dayDate: "2027-07-21",
        startTime: "10:00",
        endTime: "",
        title: "성산일출봉",
        placeName: "",
        address: "",
        memo: "",
      }),
    ).toMatchObject({ startTime: "10:00", endTime: null, placeName: null });
    expect(
      itemSchema.safeParse({ tripId: UUID, dayDate: "2027-07-21", startTime: "11:00", endTime: "10:00", title: "x", placeName: "", address: "", memo: "" })
        .success,
    ).toBe(false);
  });

  it("parses budgets and expenses", () => {
    expect(budgetSchema.parse({ tripId: UUID, category: "food", plannedAmount: "400,000" })).toEqual({
      tripId: UUID,
      category: "food",
      plannedAmount: 400000,
    });
    expect(
      expenseSchema.parse({ tripId: UUID, spentOn: "2027-07-21", category: "food", amount: "85,000", description: " 흑돼지 " }),
    ).toEqual({ tripId: UUID, spentOn: "2027-07-21", category: "food", amount: 85000, description: "흑돼지" });
    expect(expenseSchema.safeParse({ tripId: UUID, spentOn: "2027-07-21", category: "food", amount: "0", description: "" }).success).toBe(false);
  });
});
