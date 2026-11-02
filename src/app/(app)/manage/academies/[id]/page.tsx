import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, CardSkeleton } from "@/components/ui/card";
import { AcademyInfo } from "@/features/education/components/academy-info";
import { currentRules, isEnded, scheduleSummary } from "@/features/education/format";
import { getAcademies, getEnrollments } from "@/features/education/queries";
import { requestToday } from "@/lib/request-date";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "학원" };

async function AcademyContent({ params }: { params: PageProps<"/manage/academies/[id]">["params"] }) {
  const [{ id }, academies, enrollments] = await Promise.all([params, getAcademies(), getEnrollments()]);
  const academy = academies.find((item) => item.id === id);
  if (!academy) notFound();
  const today = await requestToday();
  const active = enrollments.filter(
    (enrollment) => enrollment.academy.id === academy.id && !isEnded(enrollment.endDate, today),
  );

  return (
    <>
      <h1 className="page-title">{academy.name}</h1>

      <Card title="학원 정보">
        <AcademyInfo academy={academy} />
      </Card>

      <Card
        title="수강 중"
        description="수강 과목 추가·종료·일정 변경은 교육 탭에서 합니다."
        action={
          <Link href={ROUTES.education} className="shrink-0 text-sm font-semibold text-primary">
            교육 탭
          </Link>
        }
      >
        {active.length === 0 ? (
          <p className="text-sm text-muted">지금 이 학원에 다니는 자녀가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {active.map((enrollment) => (
              <li key={enrollment.id} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: enrollment.child.color }}
                />
                <span className="font-medium">{enrollment.child.name}</span>
                <span className="text-muted">{scheduleSummary(currentRules(enrollment.rules, today))}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default function AcademyPage({ params }: PageProps<"/manage/academies/[id]">) {
  return (
    <>
      <Link href={ROUTES.manage} className="text-sm font-semibold text-primary">
        ← 관리
      </Link>
      <Suspense
        fallback={
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        }
      >
        <AcademyContent params={params} />
      </Suspense>
    </>
  );
}
