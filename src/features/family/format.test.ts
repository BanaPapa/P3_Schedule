import { describe, expect, it } from "vitest";
import { formatBirthDate, formatExpiry, roleLabel } from "./format";

describe("roleLabel", () => {
  it("labels roles in Korean", () => {
    expect(roleLabel("owner")).toBe("가족 대표");
    expect(roleLabel("parent")).toBe("부모");
  });
});

describe("formatBirthDate", () => {
  it("formats ISO dates without leading zeros", () => {
    expect(formatBirthDate("2018-03-02")).toBe("2018. 3. 2.");
  });

  it("returns null when not set", () => {
    expect(formatBirthDate(null)).toBeNull();
  });
});

describe("formatExpiry", () => {
  it("shows the Seoul local time", () => {
    // 2026-11-07 06:00 UTC = 15:00 KST
    expect(formatExpiry("2026-11-07T06:00:00Z")).toBe("11월 7일 오후 3:00까지");
  });

  it("handles midnight, noon and the morning", () => {
    expect(formatExpiry("2026-11-06T15:05:00Z")).toBe("11월 7일 오전 12:05까지");
    expect(formatExpiry("2026-11-07T03:00:00Z")).toBe("11월 7일 오후 12:00까지");
    expect(formatExpiry("2026-11-07T00:30:00Z")).toBe("11월 7일 오전 9:30까지");
  });
});
