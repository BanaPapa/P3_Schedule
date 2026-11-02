import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardSkeleton } from "@/components/ui/card";
import { deleteTripAction, deleteTripRowAction } from "@/features/travel/actions";
import { BudgetForm, ExpenseForm, TripForm, TripItemForm } from "@/features/travel/components/travel-forms";
import { CATEGORY_LABELS, tripDays, tripStatusLabel } from "@/features/travel/format";
import { getTripDetail } from "@/features/travel/queries";
import { formatDayLabel, formatDotDate, formatTime } from "@/lib/dates";
import { formatWon } from "@/lib/money";
import { requestToday } from "@/lib/request-date";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "여행" };

type Props = PageProps<"/travel/[id]">;

async function TripContent({ params }: Pick<Props, "params">) {
  const [{ id }, today] = await Promise.all([params, requestToday()]);
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getTripDetail(id);
  if (!detail) notFound();
  const { trip, items, categories, expenses } = detail;
  const days = tripDays(trip.startDate, trip.endDate);
  const remove = (table: string, rowId: string) => ({ table, id: rowId, tripId: trip.id });
  const budgetLeft = trip.budgetAmount === null ? null : trip.budgetAmount - trip.spentTotal;

  return (
    <>
      <Link href={ROUTES.travel} className="text-sm font-semibold text-primary">
        ‹ 여행
      </Link>
      <div>
        <p className="text-sm font-semibold text-primary">{tripStatusLabel(today, trip.startDate, trip.endDate)}</p>
        <h1 className="page-title">{trip.title}</h1>
        <p className="text-sm text-muted">
          {trip.destination ? `${trip.destination} · ` : ""}
          {formatDotDate(trip.startDate)} ~ {formatDotDate(trip.endDate)} ({days.length}일)
        </p>
      </div>

      <Card title="일정표">
        <div className="flex flex-col gap-4">
          {days.map((day, index) => {
            const dayItems = items.filter((item) => item.dayDate === day);
            return (
              <section key={day} aria-label={`${index + 1}일차`}>
                <h3 className="text-sm font-semibold">
                  {index + 1}일차 · {formatDayLabel(day)}
                </h3>
                {dayItems.length === 0 ? (
                  <p className="py-1 text-sm text-muted">일정 없음</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {dayItems.map((item) => (
                      <li key={item.id} className="flex items-start gap-3 py-2">
                        <span className="w-12 shrink-0 text-sm tabular-nums text-muted">
                          {item.startTime ? formatTime(item.startTime) : "종일"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{item.title}</p>
                          {item.placeName || item.address ? (
                            <p className="text-sm text-muted">{[item.placeName, item.address].filter(Boolean).join(" · ")}</p>
                          ) : null}
                          {item.memo ? <p className="text-sm text-muted">{item.memo}</p> : null}
                        </div>
                        <ActionButton action={deleteTripRowAction} fields={remove("trip_items", item.id)} label="삭제" variant="danger" />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-primary">+ 일정 추가</summary>
          <div className="mt-3">
            <TripItemForm tripId={trip.id} days={days} />
          </div>
        </details>
      </Card>

      <Card
        title="예산과 지출"
        description={
          trip.budgetAmount === null
            ? `지출 ${formatWon(trip.spentTotal)} · 분류별 예산 ${formatWon(trip.plannedTotal)}`
            : `전체 예산 ${formatWon(trip.budgetAmount)} · 지출 ${formatWon(trip.spentTotal)} · 남은 예산 ${formatWon(budgetLeft ?? 0)}`
        }
      >
        {categories.length > 0 ? (
          <table className="mb-4 w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-medium">분류</th>
                <th className="py-1 text-right font-medium">예산</th>
                <th className="py-1 text-right font-medium">지출</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((row) => (
                <tr key={row.category} className="border-t border-border">
                  <td className="py-1.5">{CATEGORY_LABELS[row.category]}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatWon(row.plannedAmount)}</td>
                  <td className={`py-1.5 text-right tabular-nums ${row.spentAmount > row.plannedAmount ? "text-danger" : ""}`}>
                    {formatWon(row.spentAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-primary">분류별 예산 정하기</summary>
          <div className="mt-3">
            <BudgetForm tripId={trip.id} />
          </div>
        </details>
      </Card>

      <Card title="지출 기록">
        {expenses.length > 0 ? (
          <ul className="mb-4 flex flex-col divide-y divide-border">
            {expenses.map((expense) => (
              <li key={expense.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  {formatDotDate(expense.spentOn)} · {CATEGORY_LABELS[expense.category]}
                  {expense.description ? ` · ${expense.description}` : ""}
                </span>
                <span className="flex items-center gap-2 tabular-nums">
                  {formatWon(expense.amount)}
                  <ActionButton
                    action={deleteTripRowAction}
                    fields={remove("trip_expenses", expense.id)}
                    label="삭제"
                    variant="danger"
                    confirmText="이 지출 기록을 지울까요?"
                  />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <ExpenseForm tripId={trip.id} today={today} />
      </Card>

      <Card>
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-primary">여행 정보 수정</summary>
          <div className="mt-3 flex flex-col gap-4">
            <TripForm trip={trip} today={today} />
            <ActionButton
              action={deleteTripAction}
              fields={{ id: trip.id, version: trip.version }}
              label="여행 삭제"
              variant="danger"
              confirmText="이 여행과 일정·예산·지출 기록을 모두 지울까요?"
            />
          </div>
        </details>
      </Card>
    </>
  );
}

export default function TripPage({ params }: Props) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <TripContent params={params} />
    </Suspense>
  );
}
