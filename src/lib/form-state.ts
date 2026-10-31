import { z } from "zod";
import { ERROR_MESSAGES } from "./errors";

export type FieldErrors = Partial<Record<string, string>>;

/** useActionState 로 주고받는 폼 결과. values 는 오류 후 입력값을 되살리는 데 쓴다. */
export type FormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message: string;
      /** 화면이 다르게 반응해야 하는 오류. conflict = 다른 사람이 먼저 수정함 */
      code?: "conflict";
      fieldErrors?: FieldErrors;
      values?: Record<string, string>;
    };

export const IDLE: FormState = { status: "idle" };

export function formValues(formData: FormData, keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    keys.map((key) => {
      const value = formData.get(key);
      return [key, typeof value === "string" ? value : ""];
    }),
  );
}

export function validationError(
  error: z.ZodError,
  values?: Record<string, string>,
): FormState {
  const { fieldErrors } = z.flattenError(error);
  const firstErrors = Object.fromEntries(
    Object.entries(fieldErrors).flatMap(([field, messages]) =>
      Array.isArray(messages) && messages[0] ? [[field, messages[0]]] : [],
    ),
  );
  return { status: "error", message: ERROR_MESSAGES.invalid_input, fieldErrors: firstErrors, values };
}

export function failure(message: string, values?: Record<string, string>): FormState {
  return { status: "error", message, values };
}

export function conflict(): FormState {
  return { status: "error", code: "conflict", message: ERROR_MESSAGES.conflict };
}

export function success(message: string): FormState {
  return { status: "success", message };
}
