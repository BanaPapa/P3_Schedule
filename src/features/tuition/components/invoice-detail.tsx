import { ActionButton } from "@/components/ui/action-button";
import { Card } from "@/components/ui/card";
import { formatDayLabel, formatDotDate, formatTime } from "@/lib/dates";
import { formatWon } from "@/lib/money";
import { SESSION_KIND_LABELS, SESSION_STATUS_LABELS } from "@/features/education/format";
import { cancelInvoiceAction, deleteItemAction, deletePaymentAction } from "../actions";
import {
  describeEstimate,
  estimateChanged,
  PAYMENT_STATUS_LABELS,
  paymentStatus,
} from "../calc";
import type { TuitionDetail } from "../queries";
import { AdjustForm, ConfirmForm, ItemForm, PaymentForm } from "./invoice-forms";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`tabular-nums ${strong ? "text-base font-bold" : ""}`}>{value}</dd>
    </div>
  );
}

/** 그 달 회차별 청구 여부 */
export function BreakdownList({ detail }: { detail: TuitionDetail }) {
  if (detail.breakdown.length === 0) return <p className="text-sm text-muted">이 달에는 수업이 없습니다.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border text-sm">
      {detail.breakdown.map((session) => (
        <li key={session.id} className="flex items-center justify-between gap-2 py-2">
          <span>
            {formatDayLabel(session.date)} {formatTime(session.startTime)}
            {SESSION_KIND_LABELS[session.kind] ? (
              <span className="ml-1.5 text-xs font-semibold text-primary">{SESSION_KIND_LABELS[session.kind]}</span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-muted">{SESSION_STATUS_LABELS[session.status]}</span>
            <span className={session.billable ? "font-semibold" : "text-muted line-through"}>
              {session.billable ? "청구" : "미청구"}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EstimateCard({ detail }: { detail: TuitionDetail }) {
  const { estimate } = detail;
  return (
    <Card title="예상 학원비" description={describeEstimate(estimate)}>
      <p className="mb-3 text-2xl font-bold tabular-nums">
        {estimate.estimatedAmount === null ? "-" : formatWon(estimate.estimatedAmount)}
      </p>
      <details>
        <summary className="cursor-pointer text-sm font-medium text-muted">수업별 청구 여부</summary>
        <div className="mt-2">
          <BreakdownList detail={detail} />
        </div>
      </details>
    </Card>
  );
}

export function UnconfirmedCard({ detail, month }: { detail: TuitionDetail; month: string }) {
  return (
    <Card title="청구 확정" description="확정하면 이후 일정이 바뀌어도 금액이 자동으로 바뀌지 않습니다.">
      <ConfirmForm enrollmentId={detail.enrollment.id} month={month} estimatedAmount={detail.estimate.estimatedAmount} />
    </Card>
  );
}

export function InvoiceCards({ detail, today }: { detail: TuitionDetail; today: string }) {
  const invoice = detail.invoice;
  if (!invoice) return null;
  const status = paymentStatus(invoice.totalAmount, invoice.paidAmount);
  const changed = estimateChanged(invoice, detail.estimate);
  const ref = { invoiceId: invoice.id, version: invoice.version };

  return (
    <>
      <Card
        title="확정 청구"
        description={`${formatDotDate(invoice.confirmedAt.slice(0, 10))} 확정 · ${describeEstimate(invoice)}`}
      >
        {changed ? (
          <div role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
            확정 뒤 일정이 바뀌어 지금 예상액은{" "}
            <strong>{detail.estimate.estimatedAmount === null ? "-" : formatWon(detail.estimate.estimatedAmount)}</strong>
            입니다. 확정액은 그대로이며, 아래에서 확인 후 조정할 수 있습니다.
          </div>
        ) : null}
        <dl className="divide-y divide-border">
          <Row label="기본 청구액" value={formatWon(invoice.baseAmount)} />
          {detail.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 py-1.5">
              <dt className="text-sm text-muted">
                {item.kind === "extra" ? "추가" : "할인"} · {item.label}
              </dt>
              <dd className="flex items-center gap-2 tabular-nums">
                {item.kind === "extra" ? "+" : "-"}
                {formatWon(item.amount)}
                <ActionButton
                  action={deleteItemAction}
                  fields={{ id: item.id, invoiceId: invoice.id }}
                  label="삭제"
                  variant="danger"
                />
              </dd>
            </div>
          ))}
          <Row label="청구 합계" value={formatWon(invoice.totalAmount)} strong />
        </dl>
        {invoice.adjustmentReason ? <p className="mt-2 text-sm text-muted">메모: {invoice.adjustmentReason}</p> : null}
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-primary">추가·할인 항목 넣기</summary>
          <div className="mt-3">
            <ItemForm invoiceId={invoice.id} />
          </div>
        </details>
        <details className="mt-3" open={changed}>
          <summary className="cursor-pointer text-sm font-medium text-primary">확정액 조정</summary>
          <div className="mt-3">
            <AdjustForm {...ref} estimatedAmount={detail.estimate.estimatedAmount} />
          </div>
        </details>
      </Card>

      <Card title="납부" description={`${PAYMENT_STATUS_LABELS[status]} · 미납 잔액 ${formatWon(Math.max(invoice.balance, 0))}`}>
        {detail.payments.length > 0 ? (
          <ul className="mb-4 flex flex-col divide-y divide-border">
            {detail.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-2 py-2">
                <span className="text-sm">
                  {formatDotDate(payment.paidOn)}
                  {payment.method ? ` · ${payment.method}` : ""}
                  {payment.memo ? <span className="block text-muted">{payment.memo}</span> : null}
                </span>
                <span className="flex items-center gap-2 tabular-nums">
                  {formatWon(payment.amount)}
                  <ActionButton
                    action={deletePaymentAction}
                    fields={{ id: payment.id, invoiceId: invoice.id }}
                    label="삭제"
                    variant="danger"
                    confirmText="이 납부 기록을 지울까요?"
                  />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <PaymentForm invoiceId={invoice.id} today={today} balance={invoice.balance} />
      </Card>

      {detail.payments.length === 0 ? (
        <ActionButton
          action={cancelInvoiceAction}
          fields={ref}
          label="청구 확정 취소"
          variant="danger"
          confirmText="이 달 청구 확정을 취소할까요? 추가·할인 항목도 함께 지워집니다."
        />
      ) : null}
    </>
  );
}
