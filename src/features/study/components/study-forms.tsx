"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { IDLE, type FormState } from "@/lib/form-state";
import { addStudyLogAction, addSubjectAction } from "../actions";

interface Option {
  id: string;
  name: string;
}

export function SubjectForm({ childOptions }: { childOptions: Option[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addSubjectAction, IDLE);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="자녀" name="childId" options={childOptions.map((c) => ({ value: c.id, label: c.name }))} error={fieldErrors?.childId} />
        <TextField label="과목" name="name" maxLength={30} placeholder="예: 수학" error={fieldErrors?.name} />
      </div>
      <TextField label="교재 (선택)" name="textbook" maxLength={50} placeholder="예: 디딤돌 기본" />
      <TextField label="목표 (선택)" name="goal" maxLength={200} placeholder="예: 1학기 분수 완성" />
      <FormMessage state={state} />
      <Button type="submit" variant="secondary" pending={pending}>
        과목 추가
      </Button>
    </form>
  );
}

export function StudyLogForm({ subjectOptions, today }: { subjectOptions: Option[]; today: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addStudyLogAction, IDLE);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="과목"
          name="subjectId"
          options={subjectOptions.map((s) => ({ value: s.id, label: s.name }))}
          defaultValue={values?.subjectId}
          error={fieldErrors?.subjectId}
        />
        <TextField label="공부한 날" name="studiedOn" type="date" defaultValue={values?.studiedOn ?? today} error={fieldErrors?.studiedOn} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <TextField label="시간 (분)" name="minutes" inputMode="numeric" placeholder="40" defaultValue={values?.minutes ?? ""} error={fieldErrors?.minutes} />
        <TextField label="진도 단원" name="unit" maxLength={50} placeholder="3단원" defaultValue={values?.unit ?? ""} />
        <TextField label="진도 %" name="progressPercent" inputMode="numeric" placeholder="30" defaultValue={values?.progressPercent ?? ""} error={fieldErrors?.progressPercent} />
      </div>
      <TextField label="한 일 (선택)" name="content" maxLength={500} placeholder="분수의 덧셈 연습" defaultValue={values?.content ?? ""} />
      <FormMessage state={state} />
      <Button type="submit" pending={pending}>
        학습 기록
      </Button>
    </form>
  );
}
