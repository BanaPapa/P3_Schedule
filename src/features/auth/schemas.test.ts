import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "./schemas";

describe("signupSchema", () => {
  it("normalizes the email", () => {
    expect(signupSchema.parse({ email: " Parent@Example.com ", password: "abcd1234" })).toEqual({
      email: "parent@example.com",
      password: "abcd1234",
    });
  });

  it.each([
    [{ email: "not-an-email", password: "abcd1234" }, "email"],
    [{ email: "a@b.co", password: "short" }, "password"],
    [{ email: "a@b.co", password: "x".repeat(73) }, "password"],
  ])("rejects %j", (input, field) => {
    const result = signupSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });
});

describe("loginSchema", () => {
  it("requires a password but not a minimum length", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});
