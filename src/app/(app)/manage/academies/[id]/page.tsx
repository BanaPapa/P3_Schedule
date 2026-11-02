import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, CardSkeleton } from "@/components/ui/card";
import { AcademyInfo } from "@/features/education/components/academy-info";
import { EnrollmentForm } from "@/features/education/components/enrollment-form";
import { EnrollmentList } from "@/features/education/components/enrollment-list";
import { getAcademies, getEnrollments } from "@/features/education/queries";
import { requireFamily } from "@/features/family/queries";
import { requestToday } from "@/lib/request-date";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "학원" };

async function AcademyContent({ params }: { params: PageProps<"/manage/academies/[id]">["params"] }) {
  const [{ id }, { children }, academies, enrollments] = await Promise.all([
    params,
    requireFamily(),
    getAcademies(),
    getEnrollments(),
  ]);
  const academy = academies.find((item) => item.id === id);
  if (!academy) notFound();
  const today = await requestToday();

  return (
    <>
      <h1 className="text-xl font-bold">{academy.name}</h1>

      <Card title="학원 정보">
        <AcademyInfo academy={academy} />
      </Card>

      <Card title="수강 과목" description="정규 수업은 캘린더에 자동으로 표시됩니다.">
        <EnrollmentList
          enrollments={enrollments.filter((enrollment) => enrollment.academy.id === academy.id)}
          today={today}
        />
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
        ) : (
          <EnrollmentForm
            academyId={academy.id}
            childOptions={children.map(({ id: childId, name }) => ({ id: childId, name }))}
            today={today}
          />
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
