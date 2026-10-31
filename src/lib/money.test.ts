import { describe, expect, it } from "vitest";
import { formatWon, parseWon } from "./money";

describe("formatWon", () => {
  it("adds thousands separators and 원", () => {
    expect(formatWon(300000)).toBe("300,000원");
    expect(formatWon(0)).toBe("0원");
  });

  it("shows negative balances with a minus sign", () => {
    expect(formatWon(-20000)).toBe("-20,000원");
  });
});

describe("parseWon", () => {
  it.each([
    ["300000", 300000],
    ["300,000", 300000],
    [" 300,000원 ", 300000],
    ["0", 0],
  ])("parses %j", (input, expected) => {
    expect(parseWon(input)).toBe(expected);
  });

  it.each(["", "  ", "삼십만", "12.5", "-1000", "1e5"])("rejects %j", (input) => {
    expect(parseWon(input)).toBeNull();
  });
});
