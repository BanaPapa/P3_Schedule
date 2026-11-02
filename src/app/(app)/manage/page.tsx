import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardSkeleton } from "@/components/ui/card";
import { AcademyForm } from "@/features/education/components/academy-form";
import { AcademyList } from "@/features/education/components/academy-list";
import { isEnded } from "@/features/education/format";
import { getAcademies, getEnrollments } from "@/features/education/queries";
import { requireFamily } from "@/features/family/queries";
import { requestToday } from "@/lib/request-date";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "관리" };

async function ManageContent() {
  const [{ family, members, children }, academies, enrollments] = await Promise.all([
    requireFamily(),
    getAcademies(),
    getEnrollments(),
  ]);
  const today = await requestToday();
  const activeCounts = new Map<string, number>();
  for (const enrollment of enrollments) {
    if (isEnded(enrollment.endDate, today)) continue;
    activeCounts.set(enrollment.academy.id, (activeCounts.get(enrollment.academy.id) ?? 0) + 1);
  }

  return (
    <>
      <Card
        title="가족"
        description={`부모 ${members.length}명 · 자녀 ${children.length}명`}
        action={
          <Link href={ROUTES.family} className="text-sm font-semibold text-primary">
            관리
          </Link>
        }
      >
        <p className="text-sm text-muted">{family.name} 구성원과 자녀 프로필, 배우자 초대를 관리합니다.</p>
      </Card>

      <Card title="학원" description="학원 등록·수정·삭제는 여기서 합니다. 수강 과목은 교육 탭에서 + 로 추가하세요.">
        <AcademyList
          academies={academies.map((academy) => ({
            id: academy.id,
            name: academy.name,
            activeCount: activeCounts.get(academy.id) ?? 0,
          }))}
        />
      </Card>

      <Card title="학원 추가">
        <AcademyForm />
      </Card>
    </>
  );
}

export default function ManagePage() {
  return (
    <>
      <h1 className="page-title">관리</h1>
      <Suspense
        fallback={
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        }
      >
        <ManageContent />
      </Suspense>
    </>
  );
}
