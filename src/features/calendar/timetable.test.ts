import { describe, expect, it } from "vitest";
import {
  CASCADE_INDENT,
  childTone,
  dayFlow,
  findOverlaps,
  hourRange,
  layoutDay,
  seoulMinutes,
  toMinutes,
} from "./timetable";

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
  const row = (p: { item: { id: string }; left: number; width: number; z: number }) => [
    p.item.id,
    Number(p.left.toFixed(2)),
    Number(p.width.toFixed(2)),
    p.z,
  ];

  it("겹치지 않으면 칸 폭을 다 쓰고 세로 위치만 계산한다", () => {
    const placed = layoutDay([item("b", "16:00", "16:50"), item("a", "13:30", "14:20")], 13);
    expect(placed.map((p) => [p.item.id, p.top, p.height, p.left, p.width])).toEqual([
      ["a", 30, 50, 0, 1],
      ["b", 180, 50, 0, 1],
    ]);
  });

  it("나중에 시작한 수업은 오른쪽으로 조금 밀어 위에 겹쳐 쌓는다", () => {
    const placed = layoutDay(
      [item("a", "13:30", "14:30"), item("b", "14:00", "14:50"), item("c", "14:50", "15:30")],
      13,
    );
    expect(placed.map(row)).toEqual([
      ["a", 0, 1, 0],
      ["b", CASCADE_INDENT, 1 - CASCADE_INDENT, 1],
      ["c", 0, 1, 0],
    ]);
  });

  it("시작 시각이 가까우면 나란히 반씩 나눈다", () => {
    const placed = layoutDay([item("a", "15:00", "17:00"), item("b", "15:10", "16:00")], 15);
    expect(placed.map(row)).toEqual([
      ["a", 0, 0.5, 0],
      ["b", 0.5, 0.5, 1],
    ]);
  });

  it("끝나자마자 시작하는 수업은 겹치지 않는다", () => {
    const placed = layoutDay([item("a", "14:00", "14:50"), item("b", "14:50", "15:30")], 14);
    expect(placed.every((p) => p.left === 0 && p.width === 1)).toBe(true);
  });

  it("여러 번 겹쳐도 절반 폭보다 좁아지지 않는다", () => {
    const placed = layoutDay(
      [item("a", "10:00", "13:00"), item("b", "10:30", "13:00"), item("c", "11:00", "13:00"), item("d", "11:30", "13:00")],
      10,
    );
    expect(placed.map((p) => Number(p.width.toFixed(2)))).toEqual([1, 0.78, 0.56, 0.5]);
    expect(placed.map((p) => p.z)).toEqual([0, 1, 2, 3]);
  });
});

describe("dayFlow", () => {
  it("시작 순으로 놓고 앞 수업과의 빈 시간을 잰다", () => {
    const flow = dayFlow([item("c", "16:00", "16:50"), item("a", "13:30", "14:30"), item("b", "14:50", "15:30")]);
    expect(flow.map((step) => [step.item.id, step.gapBefore])).toEqual([
      ["a", null],
      ["b", 20],
      ["c", 30],
    ]);
  });

  it("바로 이어지면 0, 겹치면 음수", () => {
    const flow = dayFlow([item("a", "13:30", "14:30"), item("b", "14:00", "14:50"), item("c", "14:50", "15:30")]);
    expect(flow.map((step) => step.gapBefore)).toEqual([null, -30, 0]);
  });

  it("긴 수업 안에 든 짧은 수업 다음도 긴 수업 끝을 기준으로 잰다", () => {
    const flow = dayFlow([item("a", "10:00", "12:00"), item("b", "10:30", "11:00"), item("c", "11:30", "12:30")]);
    expect(flow.map((step) => step.gapBefore)).toEqual([null, -90, -30]);
  });
});

describe("findOverlaps", () => {
  const session = (id: string, child: string, startTime: string, endTime: string, active = true) => ({
    id,
    child,
    startTime,
    endTime,
    active,
  });

  it("같은 자녀 겹침과 형제 동시 수업을 나눈다", () => {
    const { sameChild, concurrent } = findOverlaps(
      [
        session("a", "수호", "13:30", "14:30"),
        session("b", "수호", "14:00", "14:50"),
        session("c", "예린", "14:10", "15:00"),
        session("d", "예린", "16:00", "17:00"),
      ],
      (s) => s.child,
    );
    expect([...sameChild].sort()).toEqual(["a", "b"]);
    expect([...concurrent].sort()).toEqual(["a", "b", "c"]);
  });

  it("가지 않는 수업(취소·결석)은 겹침으로 보지 않는다", () => {
    const { sameChild } = findOverlaps(
      [session("a", "수호", "14:00", "15:00"), session("b", "수호", "14:30", "15:30", false)],
      (s) => s.child,
      (s) => s.active,
    );
    expect(sameChild.size).toBe(0);
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
