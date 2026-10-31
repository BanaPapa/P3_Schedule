interface SupabaseEnv {
  url: string;
  publishableKey: string;
}

/** NEXT_PUBLIC_ 값은 빌드 때 그대로 치환되므로 process.env.X 형태로 직접 읽어야 한다. */
export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 가 설정되지 않았습니다. .env.example 을 참고하세요.",
    );
  }
  return { url, publishableKey };
}
