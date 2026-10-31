import { describe, expect, it } from "vitest";
import { authErrorMessage, dbErrorMessage, ERROR_MESSAGES } from "./errors";

describe("dbErrorMessage", () => {
  it("translates RPC error codes raised by the database", () => {
    expect(dbErrorMessage({ code: "P0001", message: "family_full" })).toBe(
      ERROR_MESSAGES.family_full,
    );
    expect(dbErrorMessage({ code: "P0001", message: "invitation_expired" })).toBe(
      ERROR_MESSAGES.invitation_expired,
    );
    expect(dbErrorMessage({ code: "P0001", message: "enrollment_has_history" })).toBe(
      ERROR_MESSAGES.enrollment_has_history,
    );
  });

  it("treats permission errors as a membership problem", () => {
    expect(dbErrorMessage({ code: "42501", message: "permission denied" })).toBe(
      ERROR_MESSAGES.forbidden,
    );
  });

  it("falls back to a generic message for anything else", () => {
    expect(dbErrorMessage({ code: "P0001", message: "something_new" })).toBe(
      ERROR_MESSAGES.unknown,
    );
    expect(dbErrorMessage({ code: "23505", message: "duplicate key" })).toBe(
      ERROR_MESSAGES.unknown,
    );
    expect(dbErrorMessage(null)).toBe(ERROR_MESSAGES.unknown);
  });
});

describe("authErrorMessage", () => {
  it.each([
    ["invalid_credentials", ERROR_MESSAGES.invalid_credentials],
    ["user_already_exists", ERROR_MESSAGES.email_taken],
    ["email_exists", ERROR_MESSAGES.email_taken],
    ["weak_password", ERROR_MESSAGES.weak_password],
    ["over_request_rate_limit", ERROR_MESSAGES.rate_limited],
    ["something_else", ERROR_MESSAGES.unknown],
    [undefined, ERROR_MESSAGES.unknown],
  ])("maps %s", (code, expected) => {
    expect(authErrorMessage({ code })).toBe(expected);
  });
});
