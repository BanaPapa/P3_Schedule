/** 서버 로그. 운영 로그 도구를 붙일 때 이 파일만 바꾸면 된다. */
export const logger = {
  error(message: string, context?: Record<string, unknown>): void {
    console.error(`[family-hub] ${message}`, context ?? {});
  },
};
