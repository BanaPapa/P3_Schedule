import { describe, expect, it } from "vitest";
import {
  acceptInvitationSchema,
  childCreateSchema,
  childDeleteSchema,
  childUpdateSchema,
  createFamilySchema,
  CHILD_COLORS,
} from "./schemas";

const CODE = "0123456789abcdef0123456789abcdef";
const UUID = "6f1c2f0e-8f43-4c1e-9d55-3f0f6c2f9a11";

describe("createFamilySchema", () => {
  it("trims names", () => {
    expect(createFamilySchema.parse({ familyName: "  김씨네 ", displayName: " 아빠 " })).toEqual({
      familyName: "김씨네",
      displayName: "아빠",
    });
  });

  it.each([
    [{ familyName: "   ", displayName: "아빠" }, "familyName"],
    [{ familyName: "가".repeat(51), displayName: "아빠" }, "familyName"],
    [{ familyName: "김씨네", displayName: "" }, "displayName"],
    [{ familyName: "김씨네", displayName: "가".repeat(31) }, "displayName"],
  ])("rejects %j", (input, field) => {
    const result = createFamilySchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });
});

describe("acceptInvitationSchema", () => {
  it("accepts a valid code and display name", () => {
    expect(acceptInvitationSchema.parse({ code: CODE, displayName: "엄마" })).toEqual({
      code: CODE,
      displayName: "엄마",
    });
  });

  it("rejects malformed codes", () => {
    expect(acceptInvitationSchema.safeParse({ code: "nope", displayName: "엄마" }).success).toBe(
      false,
    );
  });
});

describe("childCreateSchema", () => {
  const today = new Date("2026-10-31T09:00:00+09:00");

  it("accepts a name with optional birth date and a palette color", () => {
    expect(
      childCreateSchema(today).parse({ name: " 첫째 ", birthDate: "2018-03-02", color: CHILD_COLORS[1] }),
    ).toEqual({ name: "첫째", birthDate: "2018-03-02", color: CHILD_COLORS[1] });
  });

  it("treats an empty birth date as not set", () => {
    expect(childCreateSchema(today).parse({ name: "첫째", birthDate: "", color: CHILD_COLORS[0] }))
      .toEqual({ name: "첫째", birthDate: null, color: CHILD_COLORS[0] });
  });

  it("rejects birth dates in the future", () => {
    const result = childCreateSchema(today).safeParse({
      name: "첫째",
      birthDate: "2026-11-01",
      color: CHILD_COLORS[0],
    });
    expect(result.success).toBe(false);
  });

  it("rejects impossible dates", () => {
    const result = childCreateSchema(today).safeParse({
      name: "첫째",
      birthDate: "2020-02-30",
      color: CHILD_COLORS[0],
    });
    expect(result.success).toBe(false);
  });

  it("rejects colors outside the palette", () => {
    const result = childCreateSchema(today).safeParse({ name: "첫째", birthDate: "", color: "#000000" });
    expect(result.success).toBe(false);
  });
});

describe("childUpdateSchema", () => {
  const today = new Date("2026-10-31T09:00:00+09:00");

  it("requires id and the version that was read", () => {
    expect(
      childUpdateSchema(today).parse({
        id: UUID,
        version: "3",
        name: "첫째",
        birthDate: "",
        color: CHILD_COLORS[0],
      }),
    ).toEqual({ id: UUID, version: 3, name: "첫째", birthDate: null, color: CHILD_COLORS[0] });
  });

  it("rejects a missing version", () => {
    const result = childUpdateSchema(today).safeParse({
      id: UUID,
      name: "첫째",
      birthDate: "",
      color: CHILD_COLORS[0],
    });
    expect(result.success).toBe(false);
  });
});

describe("childDeleteSchema", () => {
  it("parses id and version", () => {
    expect(childDeleteSchema.parse({ id: UUID, version: "1" })).toEqual({ id: UUID, version: 1 });
  });

  it("rejects non-uuid ids", () => {
    expect(childDeleteSchema.safeParse({ id: "1", version: "1" }).success).toBe(false);
  });
});
