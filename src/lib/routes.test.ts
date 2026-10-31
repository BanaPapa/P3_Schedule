import { describe, expect, it } from "vitest";
import { resolveRouteAccess, safeNextPath } from "./routes";

describe("safeNextPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNextPath("/invite/abc?x=1")).toBe("/invite/abc?x=1");
  });

  it.each([
    [null, "/"],
    ["", "/"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["invite/abc", "/"],
    // URL 파서는 탭·줄바꿈을 지우므로 "/\t/evil" 은 "//evil" 이 된다
    ["/\t/evil.example", "/"],
    ["/\n/evil.example", "/"],
    ["/\r\n/evil.example", "/"],
    ["/%09/evil.example", "/%09/evil.example"],
    ["/x\\y", "/"],
  ])("handles %j", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it("never produces a path that resolves to another origin", () => {
    const tricky = ["/\t/a.example", "/ /b.example", "/\u0000/c.example", "/%2F%2Fd.example"];
    for (const value of tricky) {
      const resolved = new URL(safeNextPath(value), "http://localhost:3000");
      expect(resolved.origin).toBe("http://localhost:3000");
    }
  });

  it("uses the given fallback", () => {
    expect(safeNextPath(undefined, "/onboarding")).toBe("/onboarding");
  });
});

describe("resolveRouteAccess", () => {
  it("lets signed-out users open login and signup", () => {
    expect(resolveRouteAccess("/login", "", false)).toEqual({ type: "next" });
    expect(resolveRouteAccess("/signup", "", false)).toEqual({ type: "next" });
  });

  it("sends signed-out users to login and remembers where they were going", () => {
    expect(resolveRouteAccess("/invite/abc", "", false)).toEqual({
      type: "redirect",
      to: "/login?next=%2Finvite%2Fabc",
    });
    expect(resolveRouteAccess("/family", "?tab=1", false)).toEqual({
      type: "redirect",
      to: "/login?next=%2Ffamily%3Ftab%3D1",
    });
  });

  it("does not add next for the home page", () => {
    expect(resolveRouteAccess("/", "", false)).toEqual({ type: "redirect", to: "/login" });
  });

  it("sends signed-in users away from login and signup", () => {
    expect(resolveRouteAccess("/login", "", true)).toEqual({ type: "redirect", to: "/" });
    expect(resolveRouteAccess("/signup", "?next=%2Ffamily", true)).toEqual({
      type: "redirect",
      to: "/family",
    });
  });

  it("lets anyone open the email confirmation link", () => {
    expect(resolveRouteAccess("/auth/confirm", "?token_hash=x&type=signup", false)).toEqual({ type: "next" });
    expect(resolveRouteAccess("/auth/confirm", "?token_hash=x&type=signup", true)).toEqual({ type: "next" });
  });

  it("lets signed-in users through to app pages", () => {
    expect(resolveRouteAccess("/family", "", true)).toEqual({ type: "next" });
  });
});
