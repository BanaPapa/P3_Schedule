"use client";

import { useEffect, useState } from "react";
import { seoulMinutes } from "../timetable";

interface NowLineProps {
  startHour: number;
  endHour: number;
}

const TICK_MS = 60_000;

/**
 * 오늘 칸의 현재 시각 선. 서버 렌더와 어긋나지 않도록 브라우저에서만 그린다.
 * 시간표 범위 밖이면 그리지 않는다.
 */
export function NowLine({ startHour, endHour }: NowLineProps) {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setMinutes(seoulMinutes(new Date()));
    update();
    const timer = setInterval(update, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  if (minutes === null) return null;
  const offset = minutes - startHour * 60;
  if (offset < 0 || offset > (endHour - startHour) * 60) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
      style={{ top: `calc(var(--tt-hour) * ${offset / 60})` }}
    >
      <span className="-ml-1 size-2 rounded-full bg-danger" />
      <span className="h-px flex-1 bg-danger" />
    </div>
  );
}
