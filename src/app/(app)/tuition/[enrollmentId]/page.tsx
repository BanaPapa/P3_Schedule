import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Card, CardSkeleton } from "@/components/ui/card";
import { EstimateCard, InvoiceCards, UnconfirmedCard } from "@/features/tuition/components/invoice-detail";
import { MonthNav } from "@/features/tuition/components/month-nav";
import { getTuitionDetail } from "@/features/tuition/queries";
import { formatMonthParam, monthOf, parseMonth } from "@/lib/dates";
import { requestToday } from "@/lib/request-date";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "교육비" };

type Props = PageProps<"/tuition/[enrollmentId]">;

async function DetailContent({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ enrollmentId }, { month: rawMonth }, today] = await Promise.all([params, searchParams, requestToday()]);
  if (!z.uuid().safeParse(enrollmentId).success) notFound();
  const month = parseMonth(typeof rawMonth === "string" ? rawMonth : null) ?? monthOf(today);
  const firstDay = `${formatMonthParam(month)}-01`;
  const detail = await getTuitionDetail(enrollmentId, firstDay);
  if (!detail) notFound();

  return (
    <>
      <Link href={`${ROUTES.tuition}?month=${formatMonthParam(month)}`} className="text-sm font-semibold text-primary">
        ‹ 교육비
      </Link>
      <div>
        <h1 className="page-title">
          {detail.enrollment.child.name} · {detail.enrollment.subject}
        </h1>
        <p className="text-sm text-muted">{detail.enrollment.academy.name}</p>
      </div>
      <MonthNav month={month} hrefFor={(value) => ROUTES.tuitionDetail(enrollmentId, value)} />

      {detail.estimate.method === null && !detail.invoice ? (
        <Card title="요금 정책 없음" description="수강료와 계산 방식을 정하면 예상 학원비가 계산됩니다.">
          <Link
            href={ROUTES.tuitionPolicy(enrollmentId)}
            className="btn-primary inline-flex h-11 items-center rounded-full px-5 text-[15px] font-extrabold"
          >
            요금 정책 설정
          </Link>
        </Card>
      ) : (
        <>
          <EstimateCard detail={detail} />
          {detail.invoice ? <InvoiceCards detail={detail} today={today} /> : <UnconfirmedCard detail={detail} month={firstDay} />}
          <Link href={ROUTES.tuitionPolicy(enrollmentId)} className="text-center text-sm font-semibold text-primary">
            요금 정책 보기·변경
          </Link>
        </>
      )}
    </>
  );
}

export default function TuitionDetailPage({ params, searchParams }: Props) {
  return (
    <Suspense
      fallback={
        <>
          <CardSkeleton />
          <CardSkeleton />
        </>
      }
    >
      <DetailContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
