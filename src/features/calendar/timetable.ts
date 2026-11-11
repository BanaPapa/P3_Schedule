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
  /** 겹치는 수업끼리 나눈 칸 번호와 칸 수 */
  lane: number;
  lanes: number;
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

/**
 * 하루치 수업을 세로 위치와 칸으로 배치한다. 시간이 겹치는 수업 묶음은 옆으로 나눠 놓는다.
 */
export function layoutDay<T extends TimedItem>(items: readonly T[], startHour: number): PlacedItem<T>[] {
  const sorted = [...items].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || toMinutes(b.endTime) - toMinutes(a.endTime),
  );

  const placed: PlacedItem<T>[] = [];
  let cluster: { item: T; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    for (const { item, lane } of cluster) {
      const start = toMinutes(item.startTime);
      placed.push({
        item,
        top: start - startHour * 60,
        height: Math.max(0, toMinutes(item.endTime) - start),
        lane,
        lanes,
      });
    }
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    const start = toMinutes(item.startTime);
    const end = toMinutes(item.endTime);
    if (cluster.length > 0 && start >= clusterEnd) flush();
    const free = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    const lane = free === -1 ? laneEnds.length : free;
    laneEnds = laneEnds.map((laneEnd, index) => (index === lane ? end : laneEnd));
    if (lane === laneEnds.length) laneEnds = [...laneEnds, end];
    cluster = [...cluster, { item, lane }];
    clusterEnd = cluster.length === 1 ? end : Math.max(clusterEnd, end);
  }
  if (cluster.length > 0) flush();
  return placed;
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
