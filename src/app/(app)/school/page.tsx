import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EducationTabs } from "@/components/education-tabs";
import { Card, CardSkeleton } from "@/components/ui/card";
import { requireFamily } from "@/features/family/queries";
import { SchoolEventList } from "@/features/school/components/school-event-list";
import { SchoolEventForm } from "@/features/school/components/school-forms";
import { getSchoolEventsBetween } from "@/features/school/queries";
import { addDays } from "@/lib/dates";
import { requestToday } from "@/lib/request-date";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "학교" };

/** 지난 일정은 최근 30일, 다가오는 일정은 1년까지 보여 준다 */
const PAST_DAYS = 30;
const FUTURE_DAYS = 365;

async function SchoolContent() {
  const [{ children }, today] = await Promise.all([requireFamily(), requestToday()]);
  const events = await getSchoolEventsBetween(addDays(today, -PAST_DAYS), addDays(today, FUTURE_DAYS));
  const upcoming = events.filter((event) => (event.endDate ?? event.eventDate) >= today);
  const past = events.filter((event) => (event.endDate ?? event.eventDate) < today).reverse();

  return (
    <>
      <Card title="다가오는 학교 일정" description="시험·과제·행사·준비물을 함께 챙깁니다.">
        <SchoolEventList events={upcoming} emptyText="등록한 학교 일정이 없습니다." />
      </Card>
      <Link
        href={ROUTES.assistant}
        className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold"
      >
        가정통신문 사진·글로 일정 찾기 (AI)
        <span aria-hidden>›</span>
      </Link>
      <Card title="학교 일정 추가">
        {children.length === 0 ? (
          <p className="text-sm text-muted">
            먼저{" "}
            <Link href={`${ROUTES.family}#children`} className="font-semibold text-primary">
              자녀를 등록
            </Link>
            해 주세요.
          </p>
        ) : (
          <SchoolEventForm childOptions={children.map(({ id, name }) => ({ id, name }))} today={today} />
        )}
      </Card>
      {past.length > 0 ? (
        <Card title="지난 30일">
          <SchoolEventList events={past} emptyText="" />
        </Card>
      ) : null}
    </>
  );
}

export default function SchoolPage() {
  return (
    <>
      <h1 className="page-title">교육</h1>
      <EducationTabs current="school" />
      <Suspense fallback={<CardSkeleton />}>
        <SchoolContent />
      </Suspense>
    </>
  );
}
