import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardSkeleton } from "@/components/ui/card";
import { MonthNav } from "@/features/tuition/components/month-nav";
import { MonthTotals, TuitionList } from "@/features/tuition/components/tuition-overview";
import { getTuitionMonth } from "@/features/tuition/queries";
import { formatMonthParam, monthOf, parseMonth } from "@/lib/dates";
import { requestToday } from "@/lib/request-date";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "교육비" };

async function TuitionContent({ searchParams }: { searchParams: PageProps<"/tuition">["searchParams"] }) {
  const [{ month: rawMonth }, today] = await Promise.all([searchParams, requestToday()]);
  const month = parseMonth(typeof rawMonth === "string" ? rawMonth : null) ?? monthOf(today);
  const firstDay = `${formatMonthParam(month)}-01`;
  const rows = await getTuitionMonth(firstDay);

  return (
    <>
      <MonthNav month={month} hrefFor={(value) => `${ROUTES.tuition}?month=${value}`} />
      <Card>
        <MonthTotals rows={rows} />
      </Card>
      {rows.length === 0 ? (
        <p className="text-center text-sm text-muted">
          이 달에 수강 중인 과목이 없습니다.{" "}
          <Link href={ROUTES.education} className="font-semibold text-primary">
            교육
          </Link>
          에서 수강 과목을 등록하세요.
        </p>
      ) : (
        <TuitionList rows={rows} month={firstDay} />
      )}
    </>
  );
}

export default function TuitionPage({ searchParams }: PageProps<"/tuition">) {
  return (
    <>
      <h1 className="text-xl font-bold">교육비</h1>
      <Suspense
        fallback={
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        }
      >
        <TuitionContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
