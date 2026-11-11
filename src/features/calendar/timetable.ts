/**
 * 주간 시간표(요일 × 시간 격자) 배치 계산. 화면과 분리한 순수 함수라 단위 테스트한다.
 */

export interface TimedItem {
  id: string;
  startTime: string;
  endTime: string;
}

export interface PlacedItem<T extends TimedItem> {
  item: T;
  /** 시간표 맨 위(startHour 정각)부터 분 */
  top: number;
  /** 길이(분) */
  height: number;
  /** 칸 안의 가로 위치와 폭(0~1) */
  left: number;
  width: number;
  /** 쌓인 순서. 클수록 위에 그린다 */
  z: number;
}

export interface HourRange {
  startHour: number;
  endHour: number;
}

/** 수업이 없을 때 보여 줄 시간대 */
const DEFAULT_RANGE: HourRange = { startHour: 9, endHour: 18 };
/** 수업이 몰려 있어도 시간표가 너무 납작하지 않도록 최소 시간 수 */
const MIN_HOURS = 6;
const LAST_HOUR = 24;

/** "14:30" 또는 "14:30:00" → 870 */
export function toMinutes(time: string): number {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** 수업이 걸친 시간대(정각 단위). 최소 MIN_HOURS 시간을 보여 준다. */
export function hourRange(items: readonly TimedItem[]): HourRange {
  if (items.length === 0) return DEFAULT_RANGE;
  const earliest = Math.min(...items.map((item) => toMinutes(item.startTime)));
  const latest = Math.max(...items.map((item) => toMinutes(item.endTime)));
  const startHour = Math.floor(earliest / 60);
  const endHour = Math.min(LAST_HOUR, Math.max(Math.ceil(latest / 60), startHour + MIN_HOURS));
  return { startHour, endHour };
}

/** 겹쳐 쌓을 때 나중 칸을 오른쪽으로 미는 정도(칸 폭 대비) */
export const CASCADE_INDENT = 0.22;
/** 시작 시각이 이보다 가까우면 제목끼리 부딪히므로 겹쳐 쌓지 않고 나란히 놓는다 */
export const SIDE_BY_SIDE_MINUTES = 20;
/** 여러 번 밀려도 이 폭보다 좁아지지 않게 한다 */
const MIN_CASCADE_WIDTH = 0.5;

const overlaps = (a: TimedItem, b: TimedItem) =>
  toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime);

/**
 * 하루치 수업을 세로 위치와 가로 자리로 배치한다(Google 캘린더 식).
 * - 겹치지 않으면 칸 폭을 다 쓴다.
 * - 먼저 시작한 수업 위에 나중 수업을 오른쪽으로 조금 밀어 겹쳐 쌓는다(두 제목이 모두 보인다).
 * - 시작 시각이 SIDE_BY_SIDE_MINUTES 안쪽으로 가까우면 그 자리를 반씩 나란히 나눈다.
 */
export function layoutDay<T extends TimedItem>(items: readonly T[], startHour: number): PlacedItem<T>[] {
  const sorted = [...items].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || toMinutes(b.endTime) - toMinutes(a.endTime),
  );

  return sorted.reduce<PlacedItem<T>[]>((placed, item) => {
    const start = toMinutes(item.startTime);
    const base = { item, top: start - startHour * 60, height: Math.max(0, toMinutes(item.endTime) - start) };
    // 겹치는 것 중 가장 위에 쌓인 수업을 기준으로 삼는다
    const parent = placed
      .filter((other) => overlaps(other.item, item))
      .reduce<PlacedItem<T> | null>((top, other) => (!top || other.z >= top.z ? other : top), null);

    if (!parent) return [...placed, { ...base, left: 0, width: 1, z: 0 }];

    if (start - toMinutes(parent.item.startTime) < SIDE_BY_SIDE_MINUTES) {
      const half = parent.width / 2;
      return [
        ...placed.map((other) => (other === parent ? { ...other, width: half } : other)),
        { ...base, left: parent.left + half, width: half, z: parent.z + 1 },
      ];
    }

    const left = Math.min(parent.left + CASCADE_INDENT, 1 - MIN_CASCADE_WIDTH);
    return [...placed, { ...base, left, width: 1 - left, z: parent.z + 1 }];
  }, []);
}

/**
 * 같은 날 수업의 겹침. 취소·결석처럼 실제로 가지 않는 수업은 빼고 본다.
 * - sameChild: 같은 자녀 수업끼리 겹침(한 아이가 동시에 두 곳에 갈 수 없으니 입력 확인 필요)
 * - concurrent: 다른 자녀 수업과 시간이 겹침(형제 동시 수업, 정상)
 */
export function findOverlaps<T extends TimedItem>(
  items: readonly T[],
  childOf: (item: T) => string,
  isActive: (item: T) => boolean = () => true,
): { sameChild: ReadonlySet<string>; concurrent: ReadonlySet<string> } {
  const active = items.filter(isActive);
  const pairs = active.flatMap((a, index) => active.slice(index + 1).filter((b) => overlaps(a, b)).map((b) => [a, b] as const));
  const ids = (same: boolean) =>
    new Set(pairs.filter(([a, b]) => (childOf(a) === childOf(b)) === same).flatMap(([a, b]) => [a.id, b.id]));
  return { sameChild: ids(true), concurrent: ids(false) };
}

export interface Tone {
  /** 아주 연한 배경 */
  background: string;
  /** 왼쪽 띠 */
  accent: string;
  /** 같은 색 계열의 진한 글자 */
  text: string;
}

/**
 * 자녀 색 하나로 수업 칸의 배경·띠·글자색을 만든다(Notion Calendar 식).
 * 테마 변수와 섞으므로 밝은·어두운 테마 모두에서 읽힌다.
 */
export function childTone(color: string): Tone {
  return {
    background: `color-mix(in oklch, ${color} 13%, var(--surface))`,
    accent: color,
    text: `color-mix(in oklch, ${color} 72%, var(--foreground))`,
  };
}

/** 서울 기준 지금 시각(분). 시간표의 현재 시각 선에 쓴다. */
export function seoulMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return value("hour") * 60 + value("minute");
}
