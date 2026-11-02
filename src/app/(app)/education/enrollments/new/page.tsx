import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardSkeleton } from "@/components/ui/card";
import { EnrollmentForm } from "@/features/education/components/enrollment-form";
import { getAcademies } from "@/features/education/queries";
import { requireFamily } from "@/features/family/queries";
import { requestToday } from "@/lib/request-date";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "수강 과목 추가" };

async function NewEnrollmentContent() {
  const [{ children }, academies] = await Promise.all([requireFamily(), getAcademies()]);
  const today = await requestToday();

  if (academies.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">
          등록된 학원이 없습니다. 먼저{" "}
          <Link href={ROUTES.manage} className="font-semibold text-primary">
            관리
          </Link>
          에서 학원을 추가해 주세요.
        </p>
      </Card>
    );
  }
  if (children.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">
          먼저{" "}
          <Link href={`${ROUTES.family}#children`} className="font-semibold text-primary">
            자녀를 등록
          </Link>
          해 주세요.
        </p>
      </Card>
    );
  }

  return (
    <Card description="관리 탭에서 등록한 학원 중에서 고르세요. 정규 수업은 캘린더에 자동으로 표시됩니다.">
      <EnrollmentForm
        academyOptions={academies.map(({ id, name }) => ({ id, name }))}
        childOptions={children.map(({ id, name }) => ({ id, name }))}
        today={today}
      />
    </Card>
  );
}

export default function NewEnrollmentPage() {
  return (
    <>
      <Link href={ROUTES.education} className="text-sm font-semibold text-primary">
        ‹ 교육
      </Link>
      <h1 className="page-title">수강 과목 추가</h1>
      <Suspense fallback={<CardSkeleton />}>
        <NewEnrollmentContent />
      </Suspense>
    </>
  );
}
