import type { ImageInput } from "./prompts";

/** 브라우저가 알려 준 형식은 믿지 않고 파일 앞부분(시그니처)으로 이미지 종류를 판단한다 */
export function detectImageType(bytes: Uint8Array): ImageInput["mediaType"] | null {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  const text = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (text(0, 4) === "RIFF" && text(8, 12) === "WEBP") return "image/webp";
  return null;
}
