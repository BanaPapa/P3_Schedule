import { z } from "zod";
import { isIsoDate } from "@/lib/dates";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max}자 이하로 입력해 주세요.` })
    .transform((value) => (value === "" ? null : value));

const optionalInt = (min: number, max: number, message: string) =>
  z.string().transform((value, ctx) => {
    if (value.trim() === "") return null;
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return number;
  });

export const subjectSchema = z.object({
  childId: z.uuid({ error: "자녀를 골라 주세요." }),
  name: z.string().trim().min(1, { error: "과목 이름을 입력해 주세요." }).max(30),
  textbook: optionalText(50),
  goal: optionalText(200),
});

export const logSchema = z.object({
  subjectId: z.uuid({ error: "과목을 골라 주세요." }),
  studiedOn: z.string().refine(isIsoDate, { error: "날짜를 올바르게 입력해 주세요." }),
  minutes: optionalInt(1, 1440, "공부한 시간은 1~1440분으로 입력해 주세요."),
  unit: optionalText(50),
  progressPercent: optionalInt(0, 100, "진도는 0~100 사이로 입력해 주세요."),
  content: optionalText(500),
});

export const studyRowSchema = z.object({ id: z.uuid() });
