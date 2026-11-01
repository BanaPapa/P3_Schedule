import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { unstable_rethrow } from "next/navigation";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * 링크 미리 가져오기(Partial Prefetching)로 프리렌더가 끝나면 Next 는 진행 중인 fetch 를 거절한다.
 * React 는 원래 이 거절을 무시하지만 supabase-js 는 이를 { error } 값으로 바꿔 돌려주므로
 * 앱이 DB 오류로 착각한다. 그 렌더 결과는 어차피 버려지니 끝나지 않는 promise 로 바꿔 둔다.
 */
const prerenderSafeFetch: typeof fetch = (input, init) =>
  fetch(input, init).catch((error: unknown) => {
    try {
      unstable_rethrow(error);
    } catch {
      return new Promise<Response>(() => {});
    }
    throw error;
  });

/** 요청마다 새로 만든다. 클라이언트를 요청 사이에 공유하면 다른 사람 세션이 섞인다. */
export async function createClient() {
  const cookieStore = await cookies();
  // supabase-js 는 세션 만료를 Date.now() 로 확인한다. 런타임 프리페치 단계에서 시각을 읽지 않도록 요청 시점까지 미룬다.
  await connection();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    global: { fetch: prerenderSafeFetch },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component 렌더 중에는 쿠키를 쓸 수 없다. 세션 갱신은 proxy가 맡는다.
        }
      },
    },
  });
}
