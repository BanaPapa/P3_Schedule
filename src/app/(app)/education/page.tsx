import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EducationTabs } from "@/components/education-tabs";
import { Card, CardSkeleton } from "@/components/ui/card";
import { EnrollmentList } from "@/features/education/components/enrollment-list";
import { getEnrollments } from "@/features/education/queries";
import { MakeupWaitlist } from "@/features/sessions/components/makeup-waitlist";
import { getMakeupWaitlist } from "@/features/sessions/queries";
import { requestToday } from "@/lib/request-date";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "교육" };

async function EducationContent() {
  const [enrollments, waiting] = await Promise.all([getEnrollments(), getMakeupWaitlist()]);
  const today = await requestToday();

  return (
    <>
      {waiting.length > 0 ? (
        <Card title={`보강 대기 ${waiting.length}건`} description="결석·휴강한 수업입니다. 눌러서 보강 일정을 등록하세요.">
          <MakeupWaitlist sessions={waiting} />
        </Card>
      ) : null}

      <Card
        title="수강 과목"
        description="정규 수업은 캘린더에 자동으로 표시됩니다."
        action={
          <Link href={ROUTES.manage} className="shrink-0 text-sm font-semibold text-primary">
            학원 관리
          </Link>
        }
      >
        <EnrollmentList enrollments={enrollments} today={today} />
        {enrollments.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            <Link href={ROUTES.manage} className="font-semibold text-primary">
              관리
            </Link>
            에서 학원을 추가한 뒤 학원 안에서 수강 과목을 등록하세요.
          </p>
        ) : null}
      </Card>
    </>
  );
}

export default function EducationPage() {
  return (
    <>
      <h1 className="page-title">교육</h1>
      <EducationTabs current="academy" />
      <Suspense
        fallback={
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        }
      >
        <EducationContent />
      </Suspense>
    </>
  );
}
