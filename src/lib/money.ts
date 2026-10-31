const WON_FORMAT = new Intl.NumberFormat("ko-KR");

/** 300000 → "300,000원" */
export function formatWon(amount: number): string {
  return `${WON_FORMAT.format(amount)}원`;
}

/** "300,000원" 같은 입력을 원 단위 정수로. 숫자가 아니면 null. */
export function parseWon(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, "").replace(/원$/, "").trim();
  if (!/^\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}
