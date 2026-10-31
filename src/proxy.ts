import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // 정적 파일, 이미지 최적화, 앱 아이콘·매니페스트(로그인 전에도 받아야 한다)는 제외한다
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon/|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
