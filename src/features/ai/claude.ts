import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { logger } from "@/lib/logger";

/** 기본 모델 (Claude Opus 5.5) */
const AI_MODEL = "claude-opus-5-5";
const MAX_TOKENS = 16000;

export type AiMode = "claude" | "fake" | "disabled";

/**
 * claude: ANTHROPIC_API_KEY 가 있을 때. fake: 테스트 전용(FAMILY_HUB_FAKE_AI=1, API 를 부르지 않음).
 * disabled: 키가 없으면 AI 화면은 설정 안내만 보여 준다.
 */
export function aiMode(): AiMode {
  // 실제 키가 있으면 언제나 실제 AI 를 쓴다. 가짜 구현은 키가 없는 테스트 환경에서만 켜진다.
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  return process.env.FAMILY_HUB_FAKE_AI === "1" ? "fake" : "disabled";
}

export const AI_MESSAGES = {
  disabled: "AI 기능이 꺼져 있습니다. 서버에 ANTHROPIC_API_KEY 를 설정하면 쓸 수 있습니다.",
  refused: "이 내용은 AI가 처리할 수 없습니다. 직접 입력해 주세요.",
  unreadable: "내용을 읽지 못했습니다. 글을 조금 줄이거나 더 선명한 사진으로 다시 시도해 주세요.",
  busy: "AI 서비스가 바쁩니다. 잠시 후 다시 시도해 주세요.",
  config: "AI 설정에 문제가 있습니다. 관리자에게 API 키를 확인해 달라고 해 주세요.",
  failed: "AI 요청이 실패했습니다. 잠시 후 다시 시도해 주세요.",
} as const;

export type AiResult<T> = { ok: true; data: T } | { ok: false; error: string };

let client: Anthropic | null = null;

function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

interface StructuredRequest<Schema extends z.ZodType> {
  schema: Schema;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  /** 추출처럼 단순한 일은 low, 분석은 medium */
  effort: "low" | "medium";
  purpose: string;
}

/** 구조화된 응답(JSON)을 받아 zod 로 검증된 결과를 돌려준다. 거절·오류는 사용자 메시지로 바꾼다. */
export async function askForStructured<Schema extends z.ZodType>({
  schema,
  system,
  content,
  effort,
  purpose,
}: StructuredRequest<Schema>): Promise<AiResult<z.infer<Schema>>> {
  try {
    const response = await getClient().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      // 안전 분류기가 거절하면 서버가 다른 모델로 다시 시도한다
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort, format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      logger.error(`${purpose}: refused`, { category: response.stop_details?.category ?? null });
      return { ok: false, error: AI_MESSAGES.refused };
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      logger.error(`${purpose}: no parsed output`, { stopReason: response.stop_reason });
      return { ok: false, error: AI_MESSAGES.unreadable };
    }
    return { ok: true, data: response.parsed_output };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
      return { ok: false, error: AI_MESSAGES.busy };
    }
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      logger.error(`${purpose}: auth`, { status: error.status });
      return { ok: false, error: AI_MESSAGES.config };
    }
    if (error instanceof Anthropic.BadRequestError) {
      logger.error(`${purpose}: bad request`, { status: error.status });
      return { ok: false, error: AI_MESSAGES.unreadable };
    }
    if (error instanceof Anthropic.APIError) {
      logger.error(`${purpose}: api error`, { status: error.status });
      return { ok: false, error: AI_MESSAGES.failed };
    }
    logger.error(`${purpose}: unexpected`, { error: error instanceof Error ? error.message : String(error) });
    return { ok: false, error: AI_MESSAGES.failed };
  }
}
