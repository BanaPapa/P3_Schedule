import { describe, expect, it } from "vitest";
import { eventDateLabel, isOnDate, KIND_LABELS, needsAttention } from "./format";
import { parseEventForm, scoreSchema } from "./schemas";
import { logSchema, subjectSchema } from "@/features/study/schemas";

const UUID = "6f1c2f0e-8f43-4c1e-9d55-3f0f6c2f9a11";

function form(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

describe("school format", () => {
  it("labels kinds in Korean", () => {
    expect(KIND_LABELS).toEqual({ academic: "학사일정", event: "행사", homework: "과제", exam: "시험", holiday: "휴업·방학" });
  });

  it("formats single and multi-day events", () => {
    expect(eventDateLabel({ eventDate: "2027-04-20", endDate: null })).toBe("4월 20일 (화)");
    expect(eventDateLabel({ eventDate: "2027-07-25", endDate: "2027-08-20" })).toBe("7월 25일 (일) ~ 8월 20일 (금)");
  });

  it("knows whether an event covers a date", () => {
    expect(isOnDate({ eventDate: "2027-07-25", endDate: "2027-08-20" }, "2027-08-01")).toBe(true);
    expect(isOnDate({ eventDate: "2027-07-25", endDate: null }, "2027-07-26")).toBe(false);
  });

  it("flags unfinished homework and unprepared supplies", () => {
    expect(needsAttention({ kind: "homework", done: false, uncheckedCount: 0 })).toBe(true);
    expect(needsAttention({ kind: "homework", done: true, uncheckedCount: 0 })).toBe(false);
    expect(needsAttention({ kind: "event", done: false, uncheckedCount: 2 })).toBe(true);
    expect(needsAttention({ kind: "exam", done: false, uncheckedCount: 0 })).toBe(true);
    expect(needsAttention({ kind: "academic", done: false, uncheckedCount: 0 })).toBe(false);
  });
});

describe("school schemas", () => {
  it("parses an event and splits supplies by comma or line", () => {
    const result = parseEventForm(
      form({
        childId: UUID,
        kind: "exam",
        eventDate: "2027-04-20",
        endDate: "",
        title: " 중간고사 ",
        subject: "수학",
        memo: "",
        supplies: "컴퓨터용 사인펜, 수정테이프\n자, ",
      }),
    );
    expect(result.data).toEqual({
      childId: UUID,
      kind: "exam",
      eventDate: "2027-04-20",
      endDate: null,
      title: "중간고사",
      subject: "수학",
      memo: null,
      supplies: ["컴퓨터용 사인펜", "수정테이프", "자"],
    });
  });

  it("rejects an end date before the date", () => {
    const result = parseEventForm(
      form({ childId: UUID, kind: "event", eventDate: "2027-05-02", endDate: "2027-05-01", title: "x", subject: "", memo: "", supplies: "" }),
    );
    expect(result.error?.issues[0]?.path).toEqual(["endDate"]);
  });

  it("checks scores against the maximum", () => {
    expect(scoreSchema.parse({ id: UUID, score: "92", maxScore: "100" })).toEqual({ id: UUID, score: 92, maxScore: 100 });
    expect(scoreSchema.safeParse({ id: UUID, score: "120", maxScore: "100" }).success).toBe(false);
    expect(scoreSchema.parse({ id: UUID, score: "", maxScore: "" })).toEqual({ id: UUID, score: null, maxScore: null });
  });
});

describe("study schemas", () => {
  it("parses subjects and logs", () => {
    expect(subjectSchema.parse({ childId: UUID, name: " 수학 ", textbook: "", goal: "분수 완성" })).toEqual({
      childId: UUID,
      name: "수학",
      textbook: null,
      goal: "분수 완성",
    });
    expect(
      logSchema.parse({ subjectId: UUID, studiedOn: "2027-04-01", minutes: "40", unit: "3단원", progressPercent: "30", content: "" }),
    ).toEqual({ subjectId: UUID, studiedOn: "2027-04-01", minutes: 40, unit: "3단원", progressPercent: 30, content: null });
    expect(
      logSchema.safeParse({ subjectId: UUID, studiedOn: "2027-04-01", minutes: "", unit: "", progressPercent: "101", content: "" }).success,
    ).toBe(false);
  });
});
