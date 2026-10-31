import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveRouteAccess } from "@/lib/routes";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

/** 만료된 토큰을 갱신해 쿠키에 다시 쓰고, 로그인 여부에 따라 경로 접근을 정한다. */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  let sessionHeaders: Record<string, string> = {};
  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        sessionHeaders = { ...headers };
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // createServerClient 와 getClaims 사이에 다른 코드를 넣지 않는다 (세션 갱신 누락 방지)
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);

  const access = resolveRouteAccess(
    request.nextUrl.pathname,
    request.nextUrl.search,
    isAuthenticated,
  );
  if (access.type === "next") return response;

  // 갱신된 세션 쿠키와 함께 Supabase 가 요구한 헤더(Cache-Control 등)도 옮긴다.
  // 빠뜨리면 Set-Cookie 가 담긴 리다이렉트가 CDN 에 캐시될 수 있다.
  const redirect = NextResponse.redirect(new URL(access.to, request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  Object.entries(sessionHeaders).forEach(([key, value]) => redirect.headers.set(key, value));
  return redirect;
}
