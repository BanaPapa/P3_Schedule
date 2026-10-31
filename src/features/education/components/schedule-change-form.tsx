"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField } from "@/components/ui/text-field";
import { IDLE, type FormState } from "@/lib/form-state";
import { changeScheduleAction } from "../actions";
import type { ClassRule } from "../queries";
import { ScheduleRows, scheduleRowsFrom, type ScheduleRow } from "./schedule-rows";

interface ScheduleChangeFormProps {
  enrollmentId: string;
  currentRules: ClassRule[];
  today: string;
  /** 수강 종료일. 변경 시작일은 이 날을 넘을 수 없다. */
  endDate: string | null;
}

export function ScheduleChangeForm({ enrollmentId, currentRules, today, endDate }: ScheduleChangeFormProps) {
  const [rows, setRows] = useState<ScheduleRow[]>(() => scheduleRowsFrom(currentRules));
  const [state, formAction, pending] = useActionState<FormState, FormData>(changeScheduleAction, IDLE);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <TextField
        label="이 날부터 적용"
        name="fromDate"
        type="date"
        required
        min={today}
        max={endDate ?? undefined}
        defaultValue={values?.fromDate ?? today}
        hint="이전 수업과 이미 결석·휴강 등으로 바꾼 수업은 그대로 남습니다."
        error={fieldErrors?.fromDate}
      />
      <ScheduleRows rows={rows} onChange={setRows} error={fieldErrors?.rules} />
      <FormMessage state={state} />
      <Button type="submit" pending={pending}>
        {pending ? "변경 중…" : "앞으로 전체 변경"}
      </Button>
    </form>
  );
}
