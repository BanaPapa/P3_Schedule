import { describe, expect, it } from "vitest";
import { currentRules, enrollmentPeriodLabel, isEnded, scheduleSummary, SESSION_STATUS_LABELS } from "./format";

const rule = (weekday: number, start: string, end: string, until: string | null = null) => ({
  id: `${weekday}-${start}`,
  weekday,
  start_time: `${start}:00`,
  end_time: `${end}:00`,
  effective_from: "2026-11-02",
  effective_until: until,
});

describe("scheduleSummary", () => {
  it("lists weekday and time for each rule", () => {
    expect(scheduleSummary([rule(2, "16:00", "17:00"), rule(4, "16:00", "17:30")])).toBe(
      "화 16:00–17:00 · 목 16:00–17:30",
    );
  });

  it("merges weekdays that share the same time", () => {
    expect(scheduleSummary([rule(1, "15:00", "16:00"), rule(3, "15:00", "16:00"), rule(5, "17:00", "18:00")])).toBe(
      "월·수 15:00–16:00 · 금 17:00–18:00",
    );
  });

  it("says when nothing is scheduled", () => {
    expect(scheduleSummary([])).toBe("정규 수업 없음");
  });
});

describe("currentRules", () => {
  it("drops rules that already stopped", () => {
    const rules = [rule(2, "16:00", "17:00", "2026-11-10"), rule(4, "16:00", "17:00")];
    expect(currentRules(rules, "2026-11-11").map((item) => item.weekday)).toEqual([4]);
    expect(currentRules(rules, "2026-11-10")).toHaveLength(2);
  });
});

describe("enrollment period", () => {
  it("describes open, ending and ended enrollments", () => {
    expect(enrollmentPeriodLabel("2026-11-02", null, "2026-11-04")).toBe("2026. 11. 2.부터");
    expect(enrollmentPeriodLabel("2026-11-02", "2026-12-31", "2026-11-04")).toBe(
      "2026. 11. 2. ~ 2026. 12. 31.",
    );
    expect(enrollmentPeriodLabel("2026-09-01", "2026-10-31", "2026-11-04")).toBe("2026. 10. 31. 종료");
  });

  it("knows when an enrollment has ended", () => {
    expect(isEnded("2026-11-03", "2026-11-04")).toBe(true);
    expect(isEnded("2026-11-04", "2026-11-04")).toBe(false);
    expect(isEnded(null, "2026-11-04")).toBe(false);
  });
});

describe("SESSION_STATUS_LABELS", () => {
  it("has a Korean label for every status from the PRD", () => {
    expect(Object.values(SESSION_STATUS_LABELS)).toEqual([
      "예정",
      "완료",
      "결석",
      "휴강",
      "취소",
      "보강 예정",
      "보강 완료",
    ]);
  });
});
