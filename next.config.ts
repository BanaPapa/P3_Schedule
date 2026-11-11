import type { NextConfig } from "next";

/** 모든 응답에 붙이는 보안 헤더 */
const SECURITY_HEADERS = [
  // 다른 사이트가 이 앱을 iframe 으로 감싸 클릭을 가로채지 못하게 한다
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    // AI 도우미의 가정통신문 사진(앱에서 3.5MB 까지 받음). 기본 1MB 로는 휴대폰 사진이 막힌다.
    serverActions: { bodySizeLimit: "5mb" },
    proxyClientMaxBodySize: "5mb",
    // 개발 서버를 강제로 끄면(Orca·터미널 종료) .next/dev 캐시가 깨져, 페이지가 끝없이
    // 새로 고쳐지는 일이 있었다. 개발 캐시를 쓰지 않는다(재시작 첫 컴파일만 조금 느려짐).
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
