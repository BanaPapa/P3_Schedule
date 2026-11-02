"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { IDLE, type FormState } from "@/lib/form-state";
import { createEnrollmentAction } from "../actions";
import { newScheduleRow, ScheduleRows, type ScheduleRow } from "./schedule-rows";

interface Option {
  id: string;
  name: string;
}

interface EnrollmentFormProps {
  /** 수강 과목을 추가할 학원 (학원 상세 화면) */
  academyId: string;
  childOptions: Option[];
  today: string;
}

export function EnrollmentForm({ academyId, childOptions, today }: EnrollmentFormProps) {
  const [rows, setRows] = useState<ScheduleRow[]>(() => [newScheduleRow()]);
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await createEnrollmentAction(prev, formData);
    // 다른 입력칸은 React 가 제출 후 비워 준다. 수업 시간 행만 직접 처음 상태로 돌린다.
    if (result.status === "success") setRows([newScheduleRow()]);
    return result;
  }, IDLE);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  const onlyChild = childOptions.length === 1 ? childOptions[0].id : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="academyId" value={academyId} />
      <SelectField
        label="자녀"
        name="childId"
        placeholder="선택"
        options={childOptions.map((child) => ({ value: child.id, label: child.name }))}
        defaultValue={values?.childId ?? onlyChild ?? ""}
        error={fieldErrors?.childId}
      />
      <TextField
        label="과목"
        name="subject"
        placeholder="예: 영어, 피아노"
        maxLength={30}
        required
        defaultValue={values?.subject}
        error={fieldErrors?.subject}
      />
      <ScheduleRows rows={rows} onChange={setRows} error={fieldErrors?.rules} />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="시작일"
          name="startDate"
          type="date"
          required
          defaultValue={values?.startDate ?? today}
          error={fieldErrors?.startDate}
        />
        <TextField
          label="종료일 (선택)"
          name="endDate"
          type="date"
          defaultValue={values?.endDate ?? ""}
          error={fieldErrors?.endDate}
        />
      </div>
      <FormMessage state={state} />
      <Button type="submit" pending={pending}>
        {pending ? "등록 중…" : "수강 과목 등록"}
      </Button>
    </form>
  );
}
