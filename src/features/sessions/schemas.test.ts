import { describe, expect, it } from "vitest";
import { sessionNoteSchema, sessionSlotSchema, sessionStatusSchema, sessionWaiveSchema } from "./schemas";

const UUID = "6f1c2f0e-8f43-4c1e-9d55-3f0f6c2f9a11";
const TODAY = new Date("2026-11-04T09:00:00+09:00");

describe("sessionStatusSchema", () => {
  it("accepts every status from the PRD", () => {
    for (const status of [
      "scheduled",
      "completed",
      "absent",
      "academy_cancelled",
      "cancelled",
      "makeup_scheduled",
      "makeup_completed",
    ]) {
      expect(sessionStatusSchema.safeParse({ id: UUID, version: "1", status }).success).toBe(true);
    }
  });

  it("rejects unknown statuses and missing versions", () => {
    expect(sessionStatusSchema.safeParse({ id: UUID, version: "1", status: "deleted" }).success).toBe(false);
    expect(sessionStatusSchema.safeParse({ id: UUID, status: "absent" }).success).toBe(false);
  });
});

describe("sessionSlotSchema", () => {
  const slot = (overrides: Record<string, string> = {}) => ({
    id: UUID,
    version: "2",
    date: "2026-11-06",
    startTime: "16:00",
    endTime: "17:00",
    ...overrides,
  });

  it("parses a date and time range", () => {
    expect(sessionSlotSchema(TODAY).parse(slot())).toEqual({
      id: UUID,
      version: 2,
      date: "2026-11-06",
      startTime: "16:00",
      endTime: "17:00",
    });
  });

  it.each([
    [{ endTime: "15:00" }, "endTime"],
    [{ startTime: "25:00" }, "startTime"],
    [{ date: "2026-02-30" }, "date"],
    [{ date: "2028-01-01" }, "date"],
    [{ date: "2025-10-01" }, "date"],
  ])("rejects %j", (overrides, field) => {
    const result = sessionSlotSchema(TODAY).safeParse(slot(overrides));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });
});

describe("sessionWaiveSchema / sessionNoteSchema", () => {
  it("reads the waive flag", () => {
    expect(sessionWaiveSchema.parse({ id: UUID, version: "3", waived: "true" }).waived).toBe(true);
    expect(sessionWaiveSchema.parse({ id: UUID, version: "3", waived: "false" }).waived).toBe(false);
    expect(sessionWaiveSchema.safeParse({ id: UUID, version: "3", waived: "yes" }).success).toBe(false);
  });

  it("trims notes and clears empty ones", () => {
    expect(sessionNoteSchema.parse({ id: UUID, version: "1", note: "  감기  " }).note).toBe("감기");
    expect(sessionNoteSchema.parse({ id: UUID, version: "1", note: "  " }).note).toBeNull();
    expect(sessionNoteSchema.safeParse({ id: UUID, version: "1", note: "가".repeat(501) }).success).toBe(false);
  });
});
