import { describe, expect, it } from "vitest";
import { enrollmentOverlapNotice, overlapNotice, overlappingSlots } from "./overlap";

const slot = (weekday: number, startTime: string, endTime: string, name = "피아노") => ({
  weekday,
  startTime,
  endTime,
  name,
});

describe("overlappingSlots", () => {
  it("같은 요일에 시간이 겹치는 기존 수업만 고른다", () => {
    const existing = [
      slot(1, "14:00:00", "14:50:00", "피아노"),
      slot(1, "16:00:00", "16:50:00", "그림책"),
      slot(2, "13:30:00", "14:30:00", "미술"),
    ];
    expect(overlappingSlots([{ weekday: 1, startTime: "13:30", endTime: "14:30" }], existing)).toEqual([
      existing[0],
    ]);
  });

  it("끝나자마자 시작하면 겹치지 않는다", () => {
    expect(
      overlappingSlots([{ weekday: 1, startTime: "14:50", endTime: "15:30" }], [slot(1, "14:00", "14:50")]),
    ).toEqual([]);
  });

  it("같은 수업이 여러 번 걸려도 한 번만, 요일·시작 순으로", () => {
    const existing = [slot(4, "14:00", "14:50"), slot(1, "14:00", "14:50"), slot(1, "14:00", "14:50")];
    const result = overlappingSlots(
      [
        { weekday: 1, startTime: "13:30", endTime: "14:30" },
        { weekday: 1, startTime: "14:20", endTime: "15:00" },
        { weekday: 4, startTime: "14:30", endTime: "15:00" },
      ],
      existing,
    );
    expect(result.map((s) => s.weekday)).toEqual([1, 4]);
  });
});

describe("enrollmentOverlapNotice", () => {
  const rule = (weekday: number, start: string, end: string, until: string | null = null) => ({
    weekday,
    start_time: start,
    end_time: end,
    effective_until: until,
  });
  const enrollment = (
    id: string,
    child: string,
    academy: string,
    rules: ReturnType<typeof rule>[],
    endDate: string | null = null,
  ) => ({ id, endDate, child: { id: child, name: child }, academy: { name: academy }, rules });

  const today = "2026-11-11";

  it("같은 자녀의 진행 중 수업과 겹치면 알려 준다", () => {
    const list = [
      enrollment("new", "수호", "지혜의숲", [rule(1, "13:30:00", "14:30:00")]),
      enrollment("p", "수호", "피아노", [rule(1, "14:00:00", "14:50:00")]),
      enrollment("b", "예린", "발레", [rule(1, "13:30:00", "14:30:00")]),
    ];
    expect(enrollmentOverlapNotice("new", list, today)).toBe(
      "수호는 월 14:00–14:50 피아노 수업과 시간이 겹칩니다. 시간이 맞는지 확인해 주세요.",
    );
  });

  it("끝난 수강 과목과 지난 규칙은 보지 않는다", () => {
    const list = [
      enrollment("new", "수호", "지혜의숲", [rule(1, "13:30", "14:30")]),
      enrollment("ended", "수호", "피아노", [rule(1, "14:00", "14:50")], "2026-11-01"),
      enrollment("old", "수호", "미술", [rule(1, "13:00", "14:00", "2026-11-10"), rule(2, "13:00", "14:00")]),
    ];
    expect(enrollmentOverlapNotice("new", list, today)).toBeNull();
  });

  it("없는 수강 과목이면 null", () => {
    expect(enrollmentOverlapNotice("x", [], today)).toBeNull();
  });
});

describe("overlapNotice", () => {
  it("겹침이 없으면 null", () => {
    expect(overlapNotice("수호", [])).toBeNull();
  });

  it("요일·시간·학원을 알려 준다", () => {
    expect(overlapNotice("수호", [slot(1, "14:00:00", "14:50:00"), slot(4, "21:00:00", "21:50:00", "윤선생")])).toBe(
      "수호는 월 14:00–14:50 피아노, 목 21:00–21:50 윤선생 수업과 시간이 겹칩니다. 시간이 맞는지 확인해 주세요.",
    );
  });
});
