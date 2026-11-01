import Link from "next/link";
import { formatTime } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";
import { tripDayNumber } from "@/features/travel/format";
import type { CalendarTrips } from "@/features/travel/queries";

interface TripAgendaProps {
  date: string;
  data: CalendarTrips;
}

/** 그날 진행 중인 여행과 여행 일정 (캘린더 날짜 목록 위에 붙인다) */
export function TripAgenda({ date, data }: TripAgendaProps) {
  const trips = data.trips.filter((trip) => trip.startDate <= date && trip.endDate >= date);
  if (trips.length === 0) return null;

  return (
    <ul className="mb-2 flex flex-col gap-1">
      {trips.map((trip) => {
        const items = data.items.filter((item) => item.tripId === trip.id && item.dayDate === date);
        return (
          <li key={trip.id} className="rounded-xl bg-amber-500/10 px-3 py-2">
            <Link href={ROUTES.trip(trip.id)} className="text-sm font-semibold">
              ✈ {trip.title} · {tripDayNumber(trip.startDate, date)}일차
            </Link>
            {items.length > 0 ? (
              <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                {items.map((item) => (
                  <li key={item.id}>
                    <span className="mr-2 tabular-nums text-muted">{item.startTime ? formatTime(item.startTime) : "종일"}</span>
                    <span>{item.title}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
