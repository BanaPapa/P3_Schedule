import Link from "next/link";
import { formatWon } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import {
  describeEstimate,
  dueDate,
  estimateChanged,
  PAYMENT_STATUS_LABELS,
  paymentStatus,
  summarizeMonth,
} from "../calc";
import type { TuitionRow } from "../queries";

const STATUS_STYLE = {
  unpaid: "bg-danger/10 text-danger",
  partial: "bg-danger/10 text-danger",
  paid: "bg-success/10 text-success",
  overpaid: "bg-primary/10 text-primary",
} as const;

export function MonthTotals({ rows }: { rows: TuitionRow[] }) {
  const summary = summarizeMonth(
    rows.map((row) => ({ estimatedAmount: row.estimate.estimatedAmount, invoice: row.invoice })),
  );
  const cells = [
    { label: "예상 교육비", value: summary.expected },
    { label: "확정 청구액", value: summary.confirmed },
    { label: "납부액", value: summary.paid },
    { label: "미납 잔액", value: summary.unpaid, danger: summary.unpaid > 0 },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3">
      {cells.map((cell) => (
        <div key={cell.label} className="rounded-xl bg-background px-3 py-2">
          <dt className="text-xs text-muted">{cell.label}</dt>
          <dd className={`text-base font-semibold tabular-nums ${cell.danger ? "text-danger" : ""}`}>
            {formatWon(cell.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RowStatus({ row }: { row: TuitionRow }) {
  if (!row.invoice) {
    return <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted">확정 전</span>;
  }
  const status = paymentStatus(row.invoice.totalAmount, row.invoice.paidAmount);
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}

interface TuitionListProps {
  rows: TuitionRow[];
  month: string;
}

/** 학원별로 묶은 과목 목록. 누르면 그 달 상세로 간다. */
export function TuitionList({ rows, month }: TuitionListProps) {
  const byAcademy = new Map<string, TuitionRow[]>();
  for (const row of rows) {
    byAcademy.set(row.enrollment.academy.name, [...(byAcademy.get(row.enrollment.academy.name) ?? []), row]);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...byAcademy.entries()].map(([academy, academyRows]) => (
        <section key={academy} aria-label={academy} className="rounded-2xl border border-border bg-surface px-4 py-3">
          <h3 className="text-sm font-semibold text-muted">{academy}</h3>
          <ul className="flex flex-col divide-y divide-border">
            {academyRows.map((row) => {
              const amount = row.invoice?.totalAmount ?? row.estimate.estimatedAmount;
              const due = dueDate(month, row.estimate.paymentDay);
              const changed = row.invoice ? estimateChanged(row.invoice, row.estimate) : false;
              return (
                <li key={row.enrollment.id}>
                  <Link href={ROUTES.tuitionDetail(row.enrollment.id, month)} className="flex items-start gap-3 py-3">
                    <span
                      aria-hidden
                      className="mt-1.5 size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.enrollment.child.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {row.enrollment.child.name} · {row.enrollment.subject}
                      </p>
                      <p className="text-sm text-muted">
                        {row.estimate.method ? describeEstimate(row.estimate) : "요금 정책을 설정해 주세요"}
                        {due ? ` · 결제일 ${Number(due.slice(5, 7))}/${Number(due.slice(8))}` : ""}
                      </p>
                      {changed ? <p className="text-sm text-danger">일정이 바뀌어 예상액이 달라졌습니다</p> : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums">{amount === null ? "-" : formatWon(amount)}</span>
                      <RowStatus row={row} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
