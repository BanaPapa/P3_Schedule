import { describe, expect, it } from "vitest";
import { getAutoLoginCredentials, isAutoLoginEnabled } from "./auto-login";

describe("getAutoLoginCredentials", () => {
  it("이메일과 비밀번호가 모두 있으면 돌려준다", () => {
    expect(
      getAutoLoginCredentials({ FAMILY_HUB_LOGIN_EMAIL: " a@b.com ", FAMILY_HUB_LOGIN_PASSWORD: "pw 1" }),
    ).toEqual({ email: "a@b.com", password: "pw 1" });
  });

  it("하나라도 없으면 끈다", () => {
    expect(getAutoLoginCredentials({ FAMILY_HUB_LOGIN_EMAIL: "a@b.com" })).toBeNull();
    expect(getAutoLoginCredentials({ FAMILY_HUB_LOGIN_PASSWORD: "pw" })).toBeNull();
    expect(getAutoLoginCredentials({ FAMILY_HUB_LOGIN_EMAIL: "  ", FAMILY_HUB_LOGIN_PASSWORD: "pw" })).toBeNull();
    expect(getAutoLoginCredentials({})).toBeNull();
  });

  it("FAMILY_HUB_DISABLE_AUTO_LOGIN=1 이면 끈다", () => {
    const env = {
      FAMILY_HUB_LOGIN_EMAIL: "a@b.com",
      FAMILY_HUB_LOGIN_PASSWORD: "pw",
      FAMILY_HUB_DISABLE_AUTO_LOGIN: "1",
    };
    expect(getAutoLoginCredentials(env)).toBeNull();
    expect(isAutoLoginEnabled(env)).toBe(false);
  });
});
