import Link from "next/link";
import { Suspense } from "react";
import { Card, CardSkeleton } from "@/components/ui/card";
import { SessionList } from "@/features/calendar/components/session-item";
import { getSessionsBetween } from "@/features/calendar/queries";
import { requireFamily } from "@/features/family/queries";
import { MakeupWaitlist } from "@/features/sessions/components/makeup-waitlist";
import { getMakeupWaitlist } from "@/features/sessions/queries";
import { formatDayLabel } from "@/lib/dates";
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
        <h1 className="text-xl font-bold">{family.name}</h1>
      </div>

      <Suspense fallback={<CardSkeleton />}>
        <TodaySchedule showChild={children.length > 1} />
      </Suspense>

      <Suspense fallback={null}>
        <MakeupAlert />
      </Suspense>

      {spouseMissing ? (
        <Card title="배우자를 초대하세요" description="함께 쓰면 한 사람이 바꾼 일정과 교육비가 서로에게 바로 보입니다.">
          <Link
            href={ROUTES.family}
            className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground"
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
