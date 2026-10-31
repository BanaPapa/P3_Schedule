import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Card, CardSkeleton } from "@/components/ui/card";
import { getEnrollments } from "@/features/education/queries";
import { METHOD_LABELS } from "@/features/tuition/calc";
import { PolicyForm } from "@/features/tuition/components/policy-form";
import { getPolicies, type Policy } from "@/features/tuition/queries";
import { formatMonthLabel, formatMonthParam, monthOf } from "@/lib/dates";
import { formatWon } from "@/lib/money";
import { requestToday } from "@/lib/request-date";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "요금 정책" };

type Props = PageProps<"/tuition/[enrollmentId]/policy">;

function policyAmount(policy: Policy): string {
  if (policy.method === "monthly") return `월 ${formatWon(policy.monthlyAmount ?? 0)}`;
  if (policy.method === "per_session") return `회당 ${formatWon(policy.perSessionAmount ?? 0)}`;
  return "매달 직접 입력";
}

async function PolicyContent({ params }: Pick<Props, "params">) {
  const [{ enrollmentId }, today] = await Promise.all([params, requestToday()]);
  if (!z.uuid().safeParse(enrollmentId).success) notFound();
  const [enrollments, policies] = await Promise.all([getEnrollments(), getPolicies(enrollmentId)]);
  const enrollment = enrollments.find((item) => item.id === enrollmentId);
  if (!enrollment) notFound();

  const thisMonth = `${formatMonthParam(monthOf(today))}-01`;
  const current = policies.find((policy) => policy.effectiveMonth <= thisMonth) ?? policies.at(-1) ?? null;

  return (
    <>
      <Link href={ROUTES.tuitionDetail(enrollmentId, thisMonth)} className="text-sm font-semibold text-primary">
        ‹ 교육비
      </Link>
      <div>
        <h1 className="text-xl font-bold">
          {enrollment.child.name} · {enrollment.subject} 요금 정책
        </h1>
        <p className="text-sm text-muted">{enrollment.academy.name}</p>
      </div>
      <Card description="수강료가 바뀌면 적용 시작 월을 바꿔 새로 저장하세요. 이전 달 계산은 이전 정책을 따릅니다.">
        <PolicyForm enrollmentId={enrollmentId} current={current} defaultMonth={formatMonthParam(monthOf(today))} />
      </Card>
      {policies.length > 0 ? (
        <Card title="정책 이력">
          <ul className="flex flex-col divide-y divide-border text-sm">
            {policies.map((policy) => (
              <li key={policy.id} className="flex items-center justify-between py-2">
                <span>{formatMonthLabel(monthOf(policy.effectiveMonth))}부터</span>
                <span className="text-muted">
                  {METHOD_LABELS[policy.method]} · {policyAmount(policy)}
                  {policy.paymentDay ? ` · 매월 ${policy.paymentDay}일` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

export default function PolicyPage({ params }: Props) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <PolicyContent params={params} />
    </Suspense>
  );
}
