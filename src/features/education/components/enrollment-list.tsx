"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField } from "@/components/ui/text-field";
import { IDLE, type FormState } from "@/lib/form-state";
import { deleteEnrollmentAction, endEnrollmentAction } from "../actions";
import { currentRules, enrollmentPeriodLabel, isEnded, scheduleSummary } from "../format";
import type { Enrollment } from "../queries";

interface EnrollmentListProps {
  enrollments: Enrollment[];
  today: string;
}

export function EnrollmentList({ enrollments, today }: EnrollmentListProps) {
  const active = enrollments.filter((enrollment) => !isEnded(enrollment.endDate, today));
  const ended = enrollments.filter((enrollment) => isEnded(enrollment.endDate, today));

  if (enrollments.length === 0) {
    return <p className="text-sm text-muted">아직 등록한 수강 과목이 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {active.length === 0 ? <p className="text-sm text-muted">지금 수강 중인 과목이 없습니다.</p> : null}
      <ul className="flex flex-col divide-y divide-border">
        {active.map((enrollment) => (
          <EnrollmentRow key={enrollment.id} enrollment={enrollment} today={today} />
        ))}
      </ul>
      {ended.length > 0 ? (
        <details className="rounded-xl bg-background px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-muted">
            종료된 과목 {ended.length}개
          </summary>
          <ul className="flex flex-col divide-y divide-border">
            {ended.map((enrollment) => (
              <EnrollmentRow key={enrollment.id} enrollment={enrollment} today={today} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function EnrollmentRow({ enrollment, today }: { enrollment: Enrollment; today: string }) {
  const [ending, setEnding] = useState(false);
  const [endState, endAction, savingEnd] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await endEnrollmentAction(prev, formData);
    if (result.status === "success") setEnding(false);
    return result;
  }, IDLE);
  const [deleteState, deleteAction, deleting] = useActionState<FormState, FormData>(
    deleteEnrollmentAction,
    IDLE,
  );
  const ended = isEnded(enrollment.endDate, today);
  const rules = ended ? enrollment.rules : currentRules(enrollment.rules, today);
  const title = `${enrollment.child.name} ${enrollment.subject}`;

  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(`${title}을(를) 삭제할까요? 예정된 수업도 함께 지워집니다.`)) event.preventDefault();
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1.5 size-3 shrink-0 rounded-full"
          style={{ backgroundColor: enrollment.child.color }}
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {enrollment.subject}
            <span className="ml-1.5 text-sm font-normal text-muted">
              {enrollment.child.name} · {enrollment.academy.name}
            </span>
          </p>
          <p className="text-sm">{scheduleSummary(rules)}</p>
          <p className="text-sm text-muted">{enrollmentPeriodLabel(enrollment.startDate, enrollment.endDate, today)}</p>
        </div>
      </div>

      {ending ? (
        <form action={endAction} className="flex items-end gap-2 pl-6">
          <input type="hidden" name="id" value={enrollment.id} />
          <TextField
            label="마지막 수업일"
            name="endDate"
            type="date"
            required
            min={enrollment.startDate}
            defaultValue={enrollment.endDate ?? today}
            className="flex-1"
          />
          <Button type="submit" pending={savingEnd}>
            저장
          </Button>
          <Button type="button" variant="secondary" onClick={() => setEnding(false)}>
            닫기
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2 pl-6">
          {ended ? null : (
            <Link
              href={ROUTES.scheduleChange(enrollment.id)}
              className="inline-flex h-9 items-center rounded-full border-[1.5px] border-border-strong bg-surface px-3 text-sm font-extrabold transition hover:bg-surface-2"
            >
              일정 변경
            </Link>
          )}
          <Button type="button" variant="secondary" className="h-9 px-3 text-sm" onClick={() => setEnding(true)}>
            {enrollment.endDate ? "종료일 변경" : "수강 종료"}
          </Button>
          <form action={deleteAction} onSubmit={confirmDelete}>
            <input type="hidden" name="id" value={enrollment.id} />
            <Button type="submit" variant="danger" className="h-9 px-3 text-sm" pending={deleting}>
              삭제
            </Button>
          </form>
        </div>
      )}
      <FormMessage state={endState} />
      <FormMessage state={deleteState} />
    </li>
  );
}
