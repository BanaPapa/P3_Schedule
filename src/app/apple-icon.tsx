import { ImageResponse } from "next/og";
import { IconArt } from "@/features/pwa/icon-art";

const SIZE = 180;

export const size = { width: SIZE, height: SIZE };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<IconArt size={SIZE} />, size);
}
