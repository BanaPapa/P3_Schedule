"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { IDLE, type FormState } from "@/lib/form-state";
import { createSchoolEventAction, saveScoreAction } from "../actions";
import { KIND_LABELS, SCHOOL_KINDS, type SchoolKind } from "../format";

interface Option {
  id: string;
  name: string;
}

export function SchoolEventForm({ childOptions, today }: { childOptions: Option[]; today: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createSchoolEventAction, IDLE);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  const [kind, setKind] = useState<SchoolKind>((values?.kind as SchoolKind | undefined) ?? "event");

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="자녀"
          name="childId"
          options={childOptions.map((child) => ({ value: child.id, label: child.name }))}
          defaultValue={values?.childId ?? childOptions[0]?.id}
          error={fieldErrors?.childId}
        />
        <SelectField
          label="종류"
          name="kind"
          options={SCHOOL_KINDS.map((value) => ({ value, label: KIND_LABELS[value] }))}
          value={kind}
          onChange={(event) => setKind(event.target.value as SchoolKind)}
          error={fieldErrors?.kind}
        />
      </div>
      <TextField label="내용" name="title" maxLength={80} placeholder="예: 현장체험학습" defaultValue={values?.title ?? ""} error={fieldErrors?.title} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label={kind === "homework" ? "마감일" : "날짜"} name="eventDate" type="date" defaultValue={values?.eventDate ?? today} error={fieldErrors?.eventDate} />
        <TextField label="끝나는 날 (선택)" name="endDate" type="date" defaultValue={values?.endDate ?? ""} error={fieldErrors?.endDate} />
      </div>
      {kind === "exam" || kind === "homework" ? (
        <TextField label="과목 (선택)" name="subject" maxLength={30} placeholder="예: 수학" defaultValue={values?.subject ?? ""} />
      ) : null}
      <TextField
        label="준비물 (선택)"
        name="supplies"
        placeholder="쉼표로 나눠 적기: 도시락, 물병"
        defaultValue={values?.supplies ?? ""}
        error={fieldErrors?.supplies}
      />
      <TextField label="메모 (선택)" name="memo" maxLength={500} defaultValue={values?.memo ?? ""} />
      <FormMessage state={state} />
      <Button type="submit" pending={pending}>
        학교 일정 등록
      </Button>
    </form>
  );
}

export function ScoreForm({ id, score, maxScore }: { id: string; score: number | null; maxScore: number | null }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveScoreAction, IDLE);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="id" value={id} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="점수" name="score" inputMode="decimal" defaultValue={score?.toString() ?? ""} error={fieldErrors?.score} />
        <TextField label="만점" name="maxScore" inputMode="decimal" defaultValue={(maxScore ?? 100).toString()} error={fieldErrors?.maxScore} />
      </div>
      <FormMessage state={state} />
      <Button type="submit" variant="secondary" pending={pending}>
        점수 저장
      </Button>
    </form>
  );
}
