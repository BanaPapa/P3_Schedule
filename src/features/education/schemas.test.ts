import { describe, expect, it } from "vitest";
import {
  academyCreateSchema,
  academyDeleteSchema,
  academyUpdateSchema,
  enrollmentEndSchema,
  parseEnrollmentForm,
  parseScheduleChangeForm,
} from "./schemas";

const UUID_A = "6f1c2f0e-8f43-4c1e-9d55-3f0f6c2f9a11";
const UUID_B = "0b7e4f6a-2d3c-4e5f-8a9b-1c2d3e4f5a6b";
const TODAY = new Date("2026-11-01T09:00:00+09:00");

function enrollmentForm(overrides: Record<string, string | string[]> = {}): FormData {
  const fields: Record<string, string | string[]> = {
    childId: UUID_A,
    academyId: UUID_B,
    subject: " 영어 ",
    startDate: "2026-11-02",
    endDate: "",
    weekday: ["2", "4"],
    startTime: ["16:00", "16:00"],
    endTime: ["17:00", "17:30"],
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) formData.append(key, item);
  }
  return formData;
}

describe("academy schemas", () => {
  it("trims and turns empty optional fields into null", () => {
    expect(
      academyCreateSchema.parse({ name: " 튼튼영어 ", phone: "", contactName: " 김원장 ", memo: "" }),
    ).toEqual({ name: "튼튼영어", phone: null, contactName: "김원장", memo: null });
  });

  it("accepts common phone formats", () => {
    for (const phone of ["02-123-4567", "010 1234 5678", "+82 10-1234-5678", "(02)1234-5678"]) {
      expect(academyCreateSchema.safeParse({ name: "a", phone, contactName: "", memo: "" }).success).toBe(true);
    }
  });

  it.each([
    [{ name: "  ", phone: "", contactName: "", memo: "" }, "name"],
    [{ name: "a", phone: "전화번호", contactName: "", memo: "" }, "phone"],
    [{ name: "a", phone: "", contactName: "", memo: "가".repeat(501) }, "memo"],
  ])("rejects %j", (input, field) => {
    const result = academyCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });

  it("requires id and version for updates and deletes", () => {
    expect(
      academyUpdateSchema.parse({ id: UUID_A, version: "2", name: "a", phone: "", contactName: "", memo: "" }),
    ).toMatchObject({ id: UUID_A, version: 2 });
    expect(academyDeleteSchema.safeParse({ id: UUID_A }).success).toBe(false);
  });
});

describe("parseEnrollmentForm", () => {
  it("collects weekly schedule rows", () => {
    const result = parseEnrollmentForm(enrollmentForm(), TODAY);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      childId: UUID_A,
      academyId: UUID_B,
      subject: "영어",
      startDate: "2026-11-02",
      endDate: null,
      rules: [
        { weekday: 2, startTime: "16:00", endTime: "17:00" },
        { weekday: 4, startTime: "16:00", endTime: "17:30" },
      ],
    });
  });

  it("requires at least one schedule row", () => {
    const result = parseEnrollmentForm(
      enrollmentForm({ weekday: [], startTime: [], endTime: [] }),
      TODAY,
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["rules"]);
  });

  it.each([
    [{ weekday: ["2"], startTime: ["17:00"], endTime: ["16:00"] }, "end before start"],
    [{ weekday: ["9"], startTime: ["16:00"], endTime: ["17:00"] }, "bad weekday"],
    [{ weekday: ["2"], startTime: ["4pm"], endTime: ["17:00"] }, "bad time"],
    [{ weekday: ["2", "2"], startTime: ["16:00", "16:00"], endTime: ["17:00", "18:00"] }, "duplicate"],
  ])("rejects schedules: %j (%s)", (overrides) => {
    const result = parseEnrollmentForm(enrollmentForm(overrides), TODAY);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path[0]).toBe("rules");
  });

  it("rejects an end date before the start date", () => {
    const result = parseEnrollmentForm(enrollmentForm({ endDate: "2026-11-01" }), TODAY);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["endDate"]);
  });

  it("rejects a start date more than a year ago", () => {
    const result = parseEnrollmentForm(enrollmentForm({ startDate: "2025-10-01" }), TODAY);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["startDate"]);
  });

  it("rejects a start date more than 400 days ahead", () => {
    const result = parseEnrollmentForm(enrollmentForm({ startDate: "2027-12-10" }), TODAY);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["startDate"]);
  });

  it("requires choosing a child and an academy", () => {
    const result = parseEnrollmentForm(enrollmentForm({ childId: "", academyId: "" }), TODAY);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(["childId", "academyId"]);
  });
});

describe("parseScheduleChangeForm", () => {
  function changeForm(fromDate: string, weekdays: string[] = ["3"]): FormData {
    const formData = new FormData();
    formData.set("enrollmentId", UUID_A);
    formData.set("fromDate", fromDate);
    for (const weekday of weekdays) {
      formData.append("weekday", weekday);
      formData.append("startTime", "17:00");
      formData.append("endTime", "18:00");
    }
    return formData;
  }

  it("parses the change date and the new schedule", () => {
    const result = parseScheduleChangeForm(changeForm("2026-11-09"), TODAY);
    expect(result.data).toEqual({
      enrollmentId: UUID_A,
      fromDate: "2026-11-09",
      rules: [{ weekday: 3, startTime: "17:00", endTime: "18:00" }],
    });
  });

  it("allows today but not the past", () => {
    expect(parseScheduleChangeForm(changeForm("2026-11-01"), TODAY).success).toBe(true);
    const past = parseScheduleChangeForm(changeForm("2026-10-31"), TODAY);
    expect(past.success).toBe(false);
    expect(past.error?.issues[0]?.path).toEqual(["fromDate"]);
  });

  it("rejects duplicate schedule rows", () => {
    const result = parseScheduleChangeForm(changeForm("2026-11-09", ["3", "3"]), TODAY);
    expect(result.error?.issues[0]?.path[0]).toBe("rules");
  });
});

describe("enrollmentEndSchema", () => {
  it("parses id and end date", () => {
    expect(enrollmentEndSchema.parse({ id: UUID_A, endDate: "2026-12-31" })).toEqual({
      id: UUID_A,
      endDate: "2026-12-31",
    });
    expect(enrollmentEndSchema.safeParse({ id: UUID_A, endDate: "2026-02-30" }).success).toBe(false);
  });
});
