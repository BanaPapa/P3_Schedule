import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "올바른 이메일 주소를 입력해 주세요." }));

export const signupSchema = z.object({
  email,
  // Supabase Auth(bcrypt)는 72바이트까지만 쓴다
  password: z
    .string()
    .min(8, { error: "비밀번호는 8자 이상으로 입력해 주세요." })
    .max(72, { error: "비밀번호는 72자 이하로 입력해 주세요." }),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "비밀번호를 입력해 주세요." }),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
