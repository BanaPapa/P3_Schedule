import { ImageResponse } from "next/og";
import { IconArt } from "@/features/pwa/icon-art";

/** 홈 화면에 추가할 때 쓰는 아이콘 크기 (manifest 가 참조한다) */
export const ICON_SIZES = { small: 192, large: 512 } as const;

export function generateImageMetadata() {
  return Object.entries(ICON_SIZES).map(([id, size]) => ({
    id,
    contentType: "image/png",
    size: { width: size, height: size },
  }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const size = ICON_SIZES[(await id) as keyof typeof ICON_SIZES] ?? ICON_SIZES.small;
  return new ImageResponse(<IconArt size={size} />, { width: size, height: size });
}
