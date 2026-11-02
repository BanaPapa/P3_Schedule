import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, CardSkeleton } from "@/components/ui/card";
import { ScheduleChangeForm } from "@/features/education/components/schedule-change-form";
import { currentRules, isEnded, scheduleSummary } from "@/features/education/format";
import { getEnrollments } from "@/features/education/queries";
import { requestToday } from "@/lib/request-date";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "일정 변경" };

async function ScheduleChangeContent({
  params,
}: {
  params: PageProps<"/education/enrollments/[id]/schedule">["params"];
}) {
  const [{ id }, enrollments] = await Promise.all([params, getEnrollments()]);
  const today = await requestToday();
  const enrollment = enrollments.find((item) => item.id === id);
  if (!enrollment) notFound();

  const rules = currentRules(enrollment.rules, today);
  const ended = isEnded(enrollment.endDate, today);

  return (
    <>
      <div>
        <h1 className="page-title">
          {enrollment.child.name} · {enrollment.subject}
        </h1>
        <p className="text-sm text-muted">
          {enrollment.academy.name} · 지금 {scheduleSummary(rules)}
        </p>
      </div>
      <Card title="앞으로 전체 변경" description="학원 시간표가 바뀌었을 때 고른 날부터 새 요일·시간으로 바꿉니다.">
        {ended ? (
          <p className="text-sm text-muted">종료된 수강 과목은 일정을 바꿀 수 없습니다.</p>
        ) : (
          <ScheduleChangeForm
            enrollmentId={enrollment.id}
            currentRules={rules}
            today={today}
            endDate={enrollment.endDate}
          />
        )}
      </Card>
    </>
  );
}

export default function ScheduleChangePage({ params }: PageProps<"/education/enrollments/[id]/schedule">) {
  return (
    <>
      <Link href={ROUTES.education} className="text-sm font-semibold text-primary">
        ‹ 교육
      </Link>
      <Suspense fallback={<CardSkeleton />}>
        <ScheduleChangeContent params={params} />
      </Suspense>
    </>
  );
}
