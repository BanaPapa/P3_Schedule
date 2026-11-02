import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { aiMode } from "@/features/ai/claude";
import { HistoryList } from "@/features/history/components/history-list";
import { getHistory } from "@/features/history/queries";
import { Card, CardSkeleton } from "@/components/ui/card";
import { SessionList } from "@/features/calendar/components/session-item";
import { getSessionsBetween } from "@/features/calendar/queries";
import { requireFamily } from "@/features/family/queries";
import { MakeupWaitlist } from "@/features/sessions/components/makeup-waitlist";
import { getMakeupWaitlist } from "@/features/sessions/queries";
import { MonthTotals } from "@/features/tuition/components/tuition-overview";
import { getTuitionMonth } from "@/features/tuition/queries";
import { SchoolEventList } from "@/features/school/components/school-event-list";
import { getSchoolEventsBetween } from "@/features/school/queries";
import { addDays, formatDayLabel, formatMonthParam, monthOf } from "@/lib/dates";
import { requestToday } from "@/lib/request-date";
import { ROUTES } from "@/lib/routes";

const MAX_PARENTS = 2;
const MAX_HOME_WAITING = 3;

/** 주요 알림: 보강을 잡아야 하는 수업 */
async function MakeupAlert() {
  const waiting = await getMakeupWaitlist();
  if (waiting.length === 0) return null;
  return (
    <Card
      title={`보강 대기 ${waiting.length}건`}
      action={
        <Link href={ROUTES.education} className="text-sm font-semibold text-primary">
          전체 보기
        </Link>
      }
    >
      <MakeupWaitlist sessions={waiting.slice(0, MAX_HOME_WAITING)} />
    </Card>
  );
}

const HOME_HISTORY_LIMIT = 5;

/** 최근 변경 (배우자가 바꾼 것은 강조) */
async function RecentChanges() {
  await connection();
  const items = await getHistory(HOME_HISTORY_LIMIT);
  if (items.length === 0) return null;
  return (
    <Card
      title="최근 변경"
      action={
        <Link href={ROUTES.history} className="text-sm font-semibold text-primary">
          전체 이력
        </Link>
      }
    >
      <HistoryList items={items} now={new Date()} />
    </Card>
  );
}

const SCHOOL_DAYS_AHEAD = 7;
const MAX_HOME_SCHOOL = 5;

/** 일주일 안의 학교 일정 (시험·과제·준비물) */
async function UpcomingSchool() {
  const today = await requestToday();
  const events = await getSchoolEventsBetween(today, addDays(today, SCHOOL_DAYS_AHEAD));
  if (events.length === 0) return null;
  return (
    <Card
      title="다가오는 학교 일정"
      action={
        <Link href={ROUTES.school} className="text-sm font-semibold text-primary">
          학교
        </Link>
      }
    >
      <SchoolEventList events={events.slice(0, MAX_HOME_SCHOOL)} emptyText="" />
    </Card>
  );
}

/** 이번 달 교육비 요약 */
async function MonthTuition() {
  const today = await requestToday();
  const month = monthOf(today);
  const rows = await getTuitionMonth(`${formatMonthParam(month)}-01`);
  if (rows.length === 0) return null;
  return (
    <Card
      title={`${month.month}월 교육비`}
      action={
        <Link href={ROUTES.tuition} className="text-sm font-semibold text-primary">
          자세히
        </Link>
      }
    >
      <MonthTotals rows={rows} />
    </Card>
  );
}

async function TodaySchedule({ showChild }: { showChild: boolean }) {
  const today = await requestToday();
  const sessions = await getSessionsBetween(today, today);
  return (
    <Card
      title={`오늘 일정 · ${formatDayLabel(today)}`}
      action={
        <Link href={ROUTES.calendar} className="text-sm font-semibold text-primary">
          캘린더
        </Link>
      }
    >
      <SessionList sessions={sessions} showChild={showChild} emptyText="오늘은 수업이 없습니다." />
    </Card>
  );
}

async function HomeContent() {
  const { family, me, members, children } = await requireFamily();
  const spouseMissing = members.length < MAX_PARENTS;

  return (
    <>
      <div>
        <p className="text-sm text-muted">{me.display_name}님, 안녕하세요</p>
        <h1 className="page-title">{family.name}</h1>
      </div>

      <Suspense fallback={<CardSkeleton />}>
        <TodaySchedule showChild={children.length > 1} />
      </Suspense>

      <Suspense fallback={null}>
        <MakeupAlert />
      </Suspense>

      <Suspense fallback={null}>
        <UpcomingSchool />
      </Suspense>

      {aiMode() === "disabled" ? null : (
        <Link
          href={ROUTES.assistant}
          className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold"
        >
          가정통신문 사진으로 일정 등록 (AI)
          <span aria-hidden>›</span>
        </Link>
      )}

      <Suspense fallback={<CardSkeleton />}>
        <MonthTuition />
      </Suspense>

      <Suspense fallback={null}>
        <RecentChanges />
      </Suspense>

      {spouseMissing ? (
        <Card title="배우자를 초대하세요" description="함께 쓰면 한 사람이 바꾼 일정과 교육비가 서로에게 바로 보입니다.">
          <Link
            href={ROUTES.family}
            className="btn-primary inline-flex h-11 items-center rounded-full px-5 text-[15px] font-extrabold"
          >
            초대 링크 만들기
          </Link>
        </Card>
      ) : null}

      <Card
        title="자녀"
        action={
          <Link href={ROUTES.family} className="text-sm font-semibold text-primary">
            관리
          </Link>
        }
      >
        {children.length === 0 ? (
          <p className="text-sm text-muted">
            아직 등록한 자녀가 없습니다.{" "}
            <Link href={`${ROUTES.family}#children`} className="font-semibold text-primary">
              자녀 등록하기
            </Link>
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {children.map((child) => (
              <li
                key={child.id}
                className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm"
              >
                <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: child.color }} />
                {child.name}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="구성원">
        <ul className="flex flex-wrap gap-2 text-sm">
          {members.map((member) => (
            <li key={member.id} className="rounded-full bg-background px-3 py-1.5">
              {member.display_name}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <>
          <CardSkeleton />
          <CardSkeleton />
        </>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
