import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Family Hub",
    short_name: "Family Hub",
    description: "부부가 함께 쓰는 가족 일정·학원·교육비 관리",
    lang: "ko",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#2563eb",
    icons: [
      { src: "/icon/small", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/large", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/large", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
