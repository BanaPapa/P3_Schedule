import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EducationTabs } from "@/components/education-tabs";
import { Card, CardSkeleton } from "@/components/ui/card";
import { EnrollmentList } from "@/features/education/components/enrollment-list";
import { enrollmentOverlapNotice } from "@/features/education/overlap";
import { getEnrollments } from "@/features/education/queries";
import { MakeupWaitlist } from "@/features/sessions/components/makeup-waitlist";
import { getMakeupWaitlist } from "@/features/sessions/queries";
import { requestToday } from "@/lib/request-date";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "교육" };

function AddEnrollmentLink() {
  return (
    <Link
      href={ROUTES.newEnrollment}
      aria-label="수강 과목 추가"
      title="수강 과목 추가"
      className="btn-primary inline-flex size-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none font-bold"
    >
      <span aria-hidden>+</span>
    </Link>
  );
}

async function EducationContent({ searchParams }: { searchParams: PageProps<"/education">["searchParams"] }) {
  const [enrollments, waiting, query] = await Promise.all([getEnrollments(), getMakeupWaitlist(), searchParams]);
  const today = await requestToday();
  const added = query.added === "1";
  // 방금 등록한 수강 과목이 같은 자녀의 다른 수업과 겹치는지 (주소의 id 는 우리 목록에 있을 때만 쓴다)
  const addedId = typeof query.id === "string" ? query.id : null;
  const overlap = added && addedId ? enrollmentOverlapNotice(addedId, enrollments, today) : null;

  return (
    <>
      {added ? (
        <p role="status" className="rounded-xl bg-mint-soft px-4 py-3 text-sm font-semibold">
          수업을 등록했습니다. 캘린더에서 확인할 수 있습니다.
        </p>
      ) : null}
      {overlap ? (
        <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm font-semibold text-danger">
          {overlap}
        </p>
      ) : null}

      {waiting.length > 0 ? (
        <Card title={`보강 대기 ${waiting.length}건`} description="결석·휴강한 수업입니다. 눌러서 보강 일정을 등록하세요.">
          <MakeupWaitlist sessions={waiting} />
        </Card>
      ) : null}

      <Card
        title="수강 과목"
        description="+ 를 눌러 관리 탭에 등록한 학원을 수강 과목으로 추가하세요."
        action={<AddEnrollmentLink />}
      >
        <EnrollmentList enrollments={enrollments} today={today} />
        {enrollments.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            학원 추가·삭제는{" "}
            <Link href={ROUTES.manage} className="font-semibold text-primary">
              관리
            </Link>
            탭에서 합니다.
          </p>
        ) : null}
      </Card>
    </>
  );
}

export default function EducationPage({ searchParams }: PageProps<"/education">) {
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
        <EducationContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
