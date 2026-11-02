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
  /** 관리 탭에서 등록한 학원. 학원 추가·삭제는 관리 탭에서만 한다. */
  academyOptions: Option[];
  childOptions: Option[];
  today: string;
}

export function EnrollmentForm({ academyOptions, childOptions, today }: EnrollmentFormProps) {
  const [rows, setRows] = useState<ScheduleRow[]>(() => [newScheduleRow()]);
  // 성공하면 서버 액션이 교육 탭으로 이동시킨다
  const [state, formAction, pending] = useActionState<FormState, FormData>(createEnrollmentAction, IDLE);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  const onlyChild = childOptions.length === 1 ? childOptions[0].id : undefined;
  const onlyAcademy = academyOptions.length === 1 ? academyOptions[0].id : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <SelectField
        label="학원"
        name="academyId"
        placeholder="선택"
        options={academyOptions.map((academy) => ({ value: academy.id, label: academy.name }))}
        defaultValue={values?.academyId ?? onlyAcademy ?? ""}
        error={fieldErrors?.academyId}
      />
      <SelectField
        label="자녀"
        name="childId"
        placeholder="선택"
        options={childOptions.map((child) => ({ value: child.id, label: child.name }))}
        defaultValue={values?.childId ?? onlyChild ?? ""}
        error={fieldErrors?.childId}
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
      <TextField
        label="비고 (선택)"
        name="memo"
        placeholder="예: 체르니 30 진도, 토요일 보충"
        maxLength={500}
        defaultValue={values?.memo ?? ""}
        error={fieldErrors?.memo}
      />
      <FormMessage state={state} />
      <Button type="submit" pending={pending}>
        {pending ? "등록 중…" : "수강 과목 등록"}
      </Button>
    </form>
  );
}
