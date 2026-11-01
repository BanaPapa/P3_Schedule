import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardSkeleton } from "@/components/ui/card";
import { getTripSpendingInMonth } from "@/features/travel/queries";
import { summarizeMonth } from "@/features/tuition/calc";
import { MonthNav } from "@/features/tuition/components/month-nav";
import { getTuitionMonth } from "@/features/tuition/queries";
import { formatMonthParam, monthBounds, monthOf, parseMonth } from "@/lib/dates";
import { formatWon } from "@/lib/money";
import { requestToday } from "@/lib/request-date";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "비용" };

/** 월별 지출: 교육비와 여행비를 한곳에서 (PRD: 비용은 통합 비용 관리에 연결) */
async function CostsContent({ searchParams }: { searchParams: PageProps<"/costs">["searchParams"] }) {
  const [{ month: rawMonth }, today] = await Promise.all([searchParams, requestToday()]);
  const month = parseMonth(typeof rawMonth === "string" ? rawMonth : null) ?? monthOf(today);
  const param = formatMonthParam(month);
  const { first, last } = monthBounds(month);
  const [tuitionRows, tripSpending] = await Promise.all([getTuitionMonth(first), getTripSpendingInMonth(first, last)]);

  const tuition = summarizeMonth(
    tuitionRows.map((row) => ({ estimatedAmount: row.estimate.estimatedAmount, invoice: row.invoice })),
  );
  const travelTotal = tripSpending.reduce((sum, trip) => sum + trip.amount, 0);

  return (
    <>
      <MonthNav month={month} hrefFor={(value) => `${ROUTES.costs}?month=${value}`} />
      <Card>
        <p className="text-sm text-muted">이번 달 지출 예상</p>
        <p className="text-2xl font-bold tabular-nums">{formatWon(tuition.expected + travelTotal)}</p>
        <p className="mt-1 text-sm text-muted">
          교육비 {formatWon(tuition.expected)} · 여행비 {formatWon(travelTotal)}
        </p>
      </Card>

      <Card
        title="교육비"
        action={
          <Link href={`${ROUTES.tuition}?month=${param}`} className="text-sm font-semibold text-primary">
            자세히
          </Link>
        }
      >
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted">예상</dt>
          <dd className="text-right tabular-nums">{formatWon(tuition.expected)}</dd>
          <dt className="text-muted">확정</dt>
          <dd className="text-right tabular-nums">{formatWon(tuition.confirmed)}</dd>
          <dt className="text-muted">납부</dt>
          <dd className="text-right tabular-nums">{formatWon(tuition.paid)}</dd>
          <dt className="text-muted">미납</dt>
          <dd className={`text-right tabular-nums ${tuition.unpaid > 0 ? "text-danger" : ""}`}>{formatWon(tuition.unpaid)}</dd>
        </dl>
        {tuition.unconfirmedCount > 0 ? (
          <p className="mt-2 text-sm text-muted">확정 전 과목 {tuition.unconfirmedCount}개는 예상액으로 더했습니다.</p>
        ) : null}
      </Card>

      <Card
        title="여행비"
        action={
          <Link href={ROUTES.travel} className="text-sm font-semibold text-primary">
            여행
          </Link>
        }
      >
        {tripSpending.length === 0 ? (
          <p className="text-sm text-muted">이 달에 기록한 여행 지출이 없습니다.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {tripSpending.map((trip) => (
              <li key={trip.tripId}>
                <Link href={ROUTES.trip(trip.tripId)} className="flex items-center justify-between py-2 text-sm">
                  <span>{trip.title}</span>
                  <span className="tabular-nums">{formatWon(trip.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default function CostsPage({ searchParams }: PageProps<"/costs">) {
  return (
    <>
      <h1 className="text-xl font-bold">비용</h1>
      <Suspense fallback={<CardSkeleton />}>
        <CostsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
