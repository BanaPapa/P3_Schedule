import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ERROR_MESSAGES } from "./errors";
import { conflict, failure, formValues, success, validationError } from "./form-state";

describe("formValues", () => {
  it("reads string fields and blanks out missing or file fields", () => {
    const formData = new FormData();
    formData.set("name", "첫째");
    formData.set("file", new Blob(["x"]));
    expect(formValues(formData, ["name", "file", "missing"])).toEqual({
      name: "첫째",
      file: "",
      missing: "",
    });
  });
});

describe("validationError", () => {
  it("keeps the first message per field", () => {
    const schema = z.object({
      name: z.string().min(1, { error: "이름 필요" }).min(2, { error: "두 글자" }),
      age: z.number({ error: "숫자" }),
    });
    const result = schema.safeParse({ name: "", age: "x" });
    expect(result.success).toBe(false);
    expect(validationError(result.error!, { name: "" })).toEqual({
      status: "error",
      message: ERROR_MESSAGES.invalid_input,
      fieldErrors: { name: "이름 필요", age: "숫자" },
      values: { name: "" },
    });
  });
});

describe("failure / conflict / success", () => {
  it("builds error and success states", () => {
    expect(failure("문제", { a: "1" })).toEqual({ status: "error", message: "문제", values: { a: "1" } });
    expect(success("완료")).toEqual({ status: "success", message: "완료" });
  });

  it("marks conflicts so the UI can show the latest data", () => {
    expect(conflict()).toEqual({
      status: "error",
      code: "conflict",
      message: ERROR_MESSAGES.conflict,
    });
  });
});
