import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardSkeleton } from "@/components/ui/card";
import { AcademyForm } from "@/features/education/components/academy-form";
import { AcademyList } from "@/features/education/components/academy-list";
import { EnrollmentForm } from "@/features/education/components/enrollment-form";
import { EnrollmentList } from "@/features/education/components/enrollment-list";
import { getAcademies, getEnrollments } from "@/features/education/queries";
import { requireFamily } from "@/features/family/queries";
import { MakeupWaitlist } from "@/features/sessions/components/makeup-waitlist";
import { getMakeupWaitlist } from "@/features/sessions/queries";
import { requestToday } from "@/lib/request-date";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "교육" };

async function EducationContent() {
  const [{ children }, academies, enrollments, waiting] = await Promise.all([
    requireFamily(),
    getAcademies(),
    getEnrollments(),
    getMakeupWaitlist(),
  ]);
  const today = await requestToday();

  return (
    <>
      {waiting.length > 0 ? (
        <Card title={`보강 대기 ${waiting.length}건`} description="결석·휴강한 수업입니다. 눌러서 보강 일정을 등록하세요.">
          <MakeupWaitlist sessions={waiting} />
        </Card>
      ) : null}

      <Card title="수강 과목" description="정규 수업은 캘린더에 자동으로 표시됩니다.">
        <EnrollmentList enrollments={enrollments} today={today} />
      </Card>

      <Card title="수강 과목 추가">
        {children.length === 0 ? (
          <p className="text-sm text-muted">
            먼저{" "}
            <Link href={`${ROUTES.family}#children`} className="font-semibold text-primary">
              자녀를 등록
            </Link>
            해 주세요.
          </p>
        ) : academies.length === 0 ? (
          <p className="text-sm text-muted">아래에서 학원을 먼저 등록해 주세요.</p>
        ) : (
          <EnrollmentForm
            childOptions={children.map(({ id, name }) => ({ id, name }))}
            academyOptions={academies.map(({ id, name }) => ({ id, name }))}
            today={today}
          />
        )}
      </Card>

      <div id="academies" className="scroll-mt-20">
        <Card title="학원">
          <AcademyList academies={academies} />
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold">학원 추가</h3>
            <AcademyForm />
          </div>
        </Card>
      </div>
    </>
  );
}

export default function EducationPage() {
  return (
    <>
      <h1 className="text-xl font-bold">교육</h1>
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
