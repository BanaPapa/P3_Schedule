import { describe, expect, it } from "vitest";
import { buildInviteUrl, isInviteCode, requestOrigin } from "./invite-url";

const CODE = "0123456789abcdef0123456789abcdef";

describe("isInviteCode", () => {
  it("accepts 32 lowercase hex characters", () => {
    expect(isInviteCode(CODE)).toBe(true);
  });

  it.each(["", "abc", CODE.toUpperCase(), `${CODE}0`, "../../etc/passwd"])(
    "rejects %s",
    (code) => {
      expect(isInviteCode(code)).toBe(false);
    },
  );
});

describe("buildInviteUrl", () => {
  it("joins origin and code", () => {
    expect(buildInviteUrl("https://family.example", CODE)).toBe(
      `https://family.example/invite/${CODE}`,
    );
  });

  it("drops a trailing slash on the origin", () => {
    expect(buildInviteUrl("http://localhost:3000/", CODE)).toBe(
      `http://localhost:3000/invite/${CODE}`,
    );
  });
});

describe("requestOrigin", () => {
  it("prefers the configured site URL", () => {
    const headers = new Headers({ host: "ignored.example" });
    expect(requestOrigin(headers, "https://family.example")).toBe("https://family.example");
  });

  it("uses forwarded headers behind a proxy", () => {
    const headers = new Headers({
      "x-forwarded-host": "family.vercel.app",
      "x-forwarded-proto": "https",
      host: "internal:3000",
    });
    expect(requestOrigin(headers)).toBe("https://family.vercel.app");
  });

  it("falls back to host over http", () => {
    expect(requestOrigin(new Headers({ host: "localhost:3000" }))).toBe("http://localhost:3000");
  });

  it("uses localhost when no host header exists", () => {
    expect(requestOrigin(new Headers())).toBe("http://localhost:3000");
  });
});
