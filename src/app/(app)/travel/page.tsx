import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardSkeleton } from "@/components/ui/card";
import { TripForm } from "@/features/travel/components/travel-forms";
import { tripStatusLabel } from "@/features/travel/format";
import { getTrips, type Trip } from "@/features/travel/queries";
import { formatDotDate } from "@/lib/dates";
import { formatWon } from "@/lib/money";
import { requestToday } from "@/lib/request-date";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "여행" };

function TripRow({ trip, today }: { trip: Trip; today: string }) {
  return (
    <li>
      <Link href={ROUTES.trip(trip.id)} className="flex items-center gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{trip.title}</p>
          <p className="text-sm text-muted">
            {trip.destination ? `${trip.destination} · ` : ""}
            {formatDotDate(trip.startDate)} ~ {formatDotDate(trip.endDate)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-semibold text-primary">{tripStatusLabel(today, trip.startDate, trip.endDate)}</span>
          <span className="text-xs text-muted tabular-nums">지출 {formatWon(trip.spentTotal)}</span>
        </div>
      </Link>
    </li>
  );
}

async function TravelContent() {
  const [trips, today] = await Promise.all([getTrips(), requestToday()]);
  const upcoming = trips.filter((trip) => trip.endDate >= today).reverse();
  const past = trips.filter((trip) => trip.endDate < today);

  return (
    <>
      <Card title="다가오는 여행">
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">계획 중인 여행이 없습니다.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {upcoming.map((trip) => (
              <TripRow key={trip.id} trip={trip} today={today} />
            ))}
          </ul>
        )}
      </Card>
      <Card title="새 여행">
        <TripForm today={today} />
      </Card>
      {past.length > 0 ? (
        <Card title="다녀온 여행">
          <ul className="flex flex-col divide-y divide-border">
            {past.map((trip) => (
              <TripRow key={trip.id} trip={trip} today={today} />
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

export default function TravelPage() {
  return (
    <>
      <h1 className="text-xl font-bold">여행</h1>
      <Suspense fallback={<CardSkeleton />}>
        <TravelContent />
      </Suspense>
    </>
  );
}
