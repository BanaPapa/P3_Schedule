import type { Metadata, Viewport } from "next";
import { Jua } from "next/font/google";
import "./globals.css";

// 제목용 둥근 글꼴. 한글 글리프가 커서 미리 불러오지 않는다.
const jua = Jua({ weight: "400", variable: "--font-jua", display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: "Family Hub", template: "%s · Family Hub" },
  description: "부부가 함께 쓰는 가족 일정·학원·교육비 관리",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8ff" },
    { media: "(prefers-color-scheme: dark)", color: "#16161f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`h-full antialiased ${jua.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
