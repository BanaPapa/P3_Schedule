import { describe, expect, it } from "vitest";
import {
  CHILD_CHANGE_NEEDS_WEEKLY,
  firstClassDate,
  sessionDeleteSchema,
  sessionEditSchema,
  weeklyFrom,
} from "./edit-schemas";

const NOW = new Date("2026-11-11T03:00:00Z"); // 서울 2026-11-11
const ID = "6f1c2f0e-8f43-4c1e-9d55-3f0f6c2f9a11";
const SUHO = "0b8a4c3e-1f2d-4e5a-9b6c-7d8e9f0a1b2c";
const YERIN = "1c9b5d4f-2a3e-4f6b-8c7d-9e0f1a2b3c4d";

const base = {
  id: ID,
  version: "1",
  childId: SUHO,
  originalChildId: SUHO,
  date: "2026-11-16",
  startTime: "14:50",
  endTime: "15:30",
  scope: "once",
};

describe("sessionEditSchema", () => {
  it("이번만 시간·날짜 변경을 받는다", () => {
    const parsed = sessionEditSchema(NOW).safeParse(base);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.version).toBe(1);
  });

  it("끝이 시작보다 늦어야 한다", () => {
    const parsed = sessionEditSchema(NOW).safeParse({ ...base, endTime: "14:00" });
    expect(parsed.success).toBe(false);
  });

  it("아이를 바꾸면 앞으로 매주만 된다", () => {
    const once = sessionEditSchema(NOW).safeParse({ ...base, childId: YERIN });
    expect(once.success).toBe(false);
    expect(once.error?.issues[0]?.message).toBe(CHILD_CHANGE_NEEDS_WEEKLY);
    expect(sessionEditSchema(NOW).safeParse({ ...base, childId: YERIN, scope: "weekly" }).success).toBe(true);
  });

  it("범위와 날짜가 엉뚱하면 거른다", () => {
    expect(sessionEditSchema(NOW).safeParse({ ...base, scope: "all" }).success).toBe(false);
    expect(sessionEditSchema(NOW).safeParse({ ...base, date: "2028-01-01" }).success).toBe(false);
    expect(sessionEditSchema(NOW).safeParse({ ...base, date: "2026-02-30" }).success).toBe(false);
  });
});

describe("sessionDeleteSchema", () => {
  it("id·version·범위를 받는다", () => {
    expect(sessionDeleteSchema.safeParse({ id: ID, version: "3", scope: "weekly" }).success).toBe(true);
    expect(sessionDeleteSchema.safeParse({ id: "x", version: "3", scope: "weekly" }).success).toBe(false);
  });
});

describe("firstClassDate", () => {
  it("기준일 이후 처음 오는 그 요일", () => {
    // 2026-11-11 은 수요일
    expect(firstClassDate("2026-11-11", 1)).toBe("2026-11-16");
    expect(firstClassDate("2026-11-11", 3)).toBe("2026-11-11");
    expect(firstClassDate("2026-11-11", 5)).toBe("2026-11-13");
  });
});

describe("weeklyFrom", () => {
  it("원래 날짜와 새 날짜 중 이른 날부터", () => {
    expect(weeklyFrom("2026-11-16", "2026-11-18", "2026-11-11")).toBe("2026-11-16");
    expect(weeklyFrom("2026-11-19", "2026-11-17", "2026-11-11")).toBe("2026-11-17");
  });

  it("이번 주 지난 요일도 바꾼다(지금 보는 시간표에 바로 보이게)", () => {
    // 오늘 11/11(수), 이번 주 월요일 11/9
    expect(weeklyFrom("2026-11-09", "2026-11-09", "2026-11-11")).toBe("2026-11-09");
  });

  it("지난주 이전이면 이번 주 월요일부터(지난 기록은 그대로)", () => {
    expect(weeklyFrom("2026-11-02", "2026-11-02", "2026-11-11")).toBe("2026-11-09");
  });
});
