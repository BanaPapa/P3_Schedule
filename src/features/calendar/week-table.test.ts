import { describe, expect, it } from "vitest";
import { buildWeekTable } from "./week-table";

const SUHO = { id: "suho", name: "수호", color: "#2563eb" };
const YERIN = { id: "yerin", name: "예린", color: "#db2777" };

const session = (
  id: string,
  child: typeof SUHO,
  academyName: string,
  date: string,
  startTime: string,
  endTime: string,
  active = true,
) => ({ id, child, academyName, date, startTime, endTime, active });

describe("buildWeekTable", () => {
  const sessions = [
    session("y1", YERIN, "발레", "2026-11-12", "15:30", "16:20"),
    session("s2", SUHO, "피아노", "2026-11-12", "14:00", "14:50"),
    session("s1", SUHO, "피아노", "2026-11-09", "14:50", "15:30"),
    session("s0", SUHO, "피아노", "2026-11-09", "14:00", "14:50"),
    session("s3", SUHO, "지혜의숲", "2026-11-09", "13:30", "14:30"),
    session("s4", SUHO, "로봇", "2026-11-13", "15:00", "17:00", false),
  ];
  const rows = buildWeekTable(sessions, ["suho", "yerin"], (s) => s.active);

  it("자녀 × 학원으로 줄을 만들고 자녀 순서, 첫 수업 순으로 놓는다", () => {
    expect(rows.map((row) => `${row.child.name} ${row.academyName}`)).toEqual([
      "수호 지혜의숲",
      "수호 피아노",
      "수호 로봇",
      "예린 발레",
    ]);
  });

  it("칸에는 그날 수업을 시작 순으로 담는다", () => {
    const piano = rows[1];
    expect(piano.cells.get("2026-11-09")?.map((s) => s.id)).toEqual(["s0", "s1"]);
    expect(piano.cells.get("2026-11-12")?.map((s) => s.id)).toEqual(["s2"]);
    expect(piano.cells.get("2026-11-10")).toBeUndefined();
  });

  it("주간 횟수와 시간은 실제로 가는 수업만 센다", () => {
    expect([rows[1].count, rows[1].minutes]).toEqual([3, 140]);
    expect([rows[2].count, rows[2].minutes]).toEqual([0, 0]);
  });
});
