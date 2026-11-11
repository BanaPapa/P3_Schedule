import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardSkeleton } from "@/components/ui/card";
import { CalendarToolbar } from "@/features/calendar/components/calendar-toolbar";
import { MonthGrid } from "@/features/calendar/components/month-grid";
import { SessionList } from "@/features/calendar/components/session-item";
import { calendarRange, groupByDate, parseCalendarParams } from "@/features/calendar/params";
import { getSessionsBetween } from "@/features/calendar/queries";
import { TripAgenda } from "@/features/calendar/components/trip-agenda";
import { SchoolAgenda } from "@/features/calendar/components/school-agenda";
import { WeekTimetable } from "@/features/calendar/components/week-timetable";
import { getSchoolEventsBetween } from "@/features/school/queries";

import { getTripsBetween } from "@/features/travel/queries";
import { requireFamily } from "@/features/family/queries";
import { datesBetween, formatDayLabel, weekDates } from "@/lib/dates";
import { requestToday } from "@/lib/request-date";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "캘린더" };

async function CalendarContent({ searchParams }: { searchParams: PageProps<"/calendar">["searchParams"] }) {
  const today = await requestToday();
  const [{ children }, rawParams] = await Promise.all([requireFamily(), searchParams]);
  const parsed = parseCalendarParams(rawParams, today);
  // 다른 가족 자녀 id 가 주소에 들어와도 우리 자녀가 아니면 필터를 무시한다
  const params = children.some((child) => child.id === parsed.childId) ? parsed : { ...parsed, childId: null };
  const { from, to } = calendarRange(params);
  const [sessions, trips, allSchoolEvents] = await Promise.all([
    getSessionsBetween(from, to, params.childId),
    getTripsBetween(from, to),
    getSchoolEventsBetween(from, to),
  ]);
  const schoolEvents = params.childId ? allSchoolEvents.filter((event) => event.child.id === params.childId) : allSchoolEvents;
  const schoolDates = new Set(
    schoolEvents.flatMap((event) => datesBetween(event.eventDate, event.endDate ?? event.eventDate).filter((day) => day >= from && day <= to)),
  );
  const tripDates = new Set(
    trips.trips.flatMap((trip) => datesBetween(trip.startDate, trip.endDate).filter((day) => day >= from && day <= to)),
  );
  const byDate = groupByDate(sessions);
  const showChild = params.childId === null && children.length > 1;

  return (
    <>
      <CalendarToolbar
        params={params}
        today={today}
        childOptions={children.map(({ id, name, color }) => ({ id, name, color }))}
      />

      {params.view === "month" ? (
        <>
          <MonthGrid params={params} today={today} sessionsByDate={byDate} tripDates={tripDates} schoolDates={schoolDates} />
          <Card title={formatDayLabel(params.date)}>
            <TripAgenda date={params.date} data={trips} />
            <SchoolAgenda date={params.date} events={schoolEvents} />
            <SessionList sessions={byDate.get(params.date) ?? []} showChild={showChild} emptyText="이날은 수업이 없습니다." />
          </Card>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <WeekTimetable dates={weekDates(params.date)} today={today} sessionsByDate={byDate} showChild={showChild} />
          {/* 여행·학교 일정은 시간이 없으므로 시간표 아래에 날짜별로 따로 보인다 */}
          {weekDates(params.date)
            .filter((date) => tripDates.has(date) || schoolDates.has(date))
            .map((date) => (
              <section
                key={date}
                aria-label={`${formatDayLabel(date)} 종일 일정`}
                className={`rounded-2xl border bg-surface px-4 py-3 ${date === today ? "border-primary" : "border-border"}`}
              >
                <h3 className="text-sm font-semibold">
                  {formatDayLabel(date)}
                  {date === today ? <span className="ml-2 text-primary">오늘</span> : null}
                </h3>
                <TripAgenda date={date} data={trips} />
                <SchoolAgenda date={date} events={schoolEvents} />
              </section>
            ))}
        </div>
      )}

      {sessions.length === 0 ? (
        <p className="text-center text-sm text-muted">
          학원 수업은{" "}
          <Link href={ROUTES.manage} className="font-semibold text-primary">
            관리
          </Link>
          에서 학원과 수강 과목을 등록하면 표시됩니다.
        </p>
      ) : null}
    </>
  );
}

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <>
      <h1 className="sr-only">캘린더</h1>
      <Suspense
        fallback={
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        }
      >
        <CalendarContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
