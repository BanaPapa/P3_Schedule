import { describe, expect, it } from "vitest";
import { childTone, hourRange, layoutDay, seoulMinutes, toMinutes } from "./timetable";

const item = (id: string, startTime: string, endTime: string) => ({ id, startTime, endTime });

describe("toMinutes", () => {
  it("초가 붙어 있어도 분으로 바꾼다", () => {
    expect(toMinutes("14:30")).toBe(870);
    expect(toMinutes("09:05:00")).toBe(545);
  });
});

describe("hourRange", () => {
  it("수업이 없으면 기본 9~18시", () => {
    expect(hourRange([])).toEqual({ startHour: 9, endHour: 18 });
  });

  it("가장 이른 시작과 가장 늦은 끝을 정각으로 넓힌다", () => {
    expect(hourRange([item("a", "13:30:00", "14:20:00"), item("b", "21:00:00", "21:50:00")])).toEqual({
      startHour: 13,
      endHour: 22,
    });
  });

  it("최소 6시간은 보여 주되 24시를 넘지 않는다", () => {
    expect(hourRange([item("a", "15:00", "16:00")])).toEqual({ startHour: 15, endHour: 21 });
    expect(hourRange([item("a", "22:00", "23:30")])).toEqual({ startHour: 22, endHour: 24 });
  });
});

describe("layoutDay", () => {
  it("겹치지 않으면 한 칸에 세로 위치만 계산한다", () => {
    const placed = layoutDay([item("b", "16:00", "16:50"), item("a", "13:30", "14:20")], 13);
    expect(placed.map((p) => [p.item.id, p.top, p.height, p.lane, p.lanes])).toEqual([
      ["a", 30, 50, 0, 1],
      ["b", 180, 50, 0, 1],
    ]);
  });

  it("겹치는 수업은 옆 칸으로 나눈다", () => {
    const placed = layoutDay(
      [item("a", "13:30", "14:20"), item("b", "14:00", "14:50"), item("c", "14:50", "15:30")],
      13,
    );
    expect(placed.map((p) => [p.item.id, p.lane, p.lanes])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 0, 1],
    ]);
  });

  it("끝나자마자 시작하는 수업은 겹치지 않는다", () => {
    const placed = layoutDay([item("a", "14:00", "14:50"), item("b", "14:50", "15:30")], 14);
    expect(placed.every((p) => p.lanes === 1)).toBe(true);
  });

  it("빈 칸을 다시 쓴다", () => {
    const placed = layoutDay(
      [item("a", "10:00", "12:00"), item("b", "10:00", "10:30"), item("c", "10:30", "11:00")],
      10,
    );
    expect(placed.map((p) => [p.item.id, p.lane, p.lanes])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 1, 2],
    ]);
  });
});

describe("childTone", () => {
  it("자녀 색으로 연한 배경, 진한 띠, 같은 계열 글자색을 만든다", () => {
    expect(childTone("#2563eb")).toEqual({
      background: "color-mix(in oklch, #2563eb 13%, var(--surface))",
      accent: "#2563eb",
      text: "color-mix(in oklch, #2563eb 72%, var(--foreground))",
    });
  });
});

describe("seoulMinutes", () => {
  it("서울 시각으로 자정부터 분을 센다", () => {
    // UTC 07:30 = 서울 16:30
    expect(seoulMinutes(new Date("2026-11-11T07:30:00Z"))).toBe(990);
    // UTC 15:05 = 서울 다음 날 00:05
    expect(seoulMinutes(new Date("2026-11-11T15:05:00Z"))).toBe(5);
  });
});
