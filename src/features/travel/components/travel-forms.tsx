"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { formatDayLabel } from "@/lib/dates";
import { IDLE, type FormState } from "@/lib/form-state";
import { addExpenseAction, addTripItemAction, createTripAction, saveBudgetAction, updateTripAction } from "../actions";
import { CATEGORY_LABELS, TRIP_CATEGORIES } from "../format";
import type { Trip } from "../queries";

const CATEGORY_OPTIONS = TRIP_CATEGORIES.map((category) => ({ value: category, label: CATEGORY_LABELS[category] }));

function useForm(action: (prev: FormState, formData: FormData) => Promise<FormState>) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, IDLE);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  return { state, formAction, pending, fieldErrors, values };
}

/** 새 여행 만들기 또는 여행 정보 수정 */
export function TripForm({ trip, today }: { trip?: Trip; today: string }) {
  const { state, formAction, pending, fieldErrors, values } = useForm(trip ? updateTripAction : createTripAction);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {trip ? (
        <>
          <input type="hidden" name="id" value={trip.id} />
          <input type="hidden" name="version" value={trip.version} />
        </>
      ) : null}
      <TextField label="여행 이름" name="title" maxLength={50} placeholder="예: 제주 여름 여행" defaultValue={values?.title ?? trip?.title} error={fieldErrors?.title} />
      <TextField label="여행지 (선택)" name="destination" maxLength={50} placeholder="예: 제주" defaultValue={values?.destination ?? trip?.destination ?? ""} error={fieldErrors?.destination} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="떠나는 날" name="startDate" type="date" defaultValue={values?.startDate ?? trip?.startDate ?? today} error={fieldErrors?.startDate} />
        <TextField label="돌아오는 날" name="endDate" type="date" defaultValue={values?.endDate ?? trip?.endDate ?? today} error={fieldErrors?.endDate} />
      </div>
      <TextField
        label="전체 예산 (선택, 원)"
        name="budgetAmount"
        inputMode="numeric"
        placeholder="1,500,000"
        defaultValue={values?.budgetAmount ?? trip?.budgetAmount?.toLocaleString("ko-KR") ?? ""}
        error={fieldErrors?.budgetAmount}
      />
      <TextField label="메모 (선택)" name="memo" maxLength={1000} defaultValue={values?.memo ?? trip?.memo ?? ""} error={fieldErrors?.memo} />
      <FormMessage state={state} />
      <Button type="submit" pending={pending}>
        {trip ? "저장" : "여행 만들기"}
      </Button>
    </form>
  );
}

export function TripItemForm({ tripId, days }: { tripId: string; days: string[] }) {
  const { state, formAction, pending, fieldErrors, values } = useForm(addTripItemAction);
  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="tripId" value={tripId} />
      <SelectField
        label="날짜"
        name="dayDate"
        options={days.map((day, index) => ({ value: day, label: `${index + 1}일차 · ${formatDayLabel(day)}` }))}
        defaultValue={values?.dayDate ?? days[0]}
        error={fieldErrors?.dayDate}
      />
      <TextField label="일정" name="title" maxLength={80} placeholder="예: 성산일출봉" defaultValue={values?.title ?? ""} error={fieldErrors?.title} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="시작 (선택)" name="startTime" type="time" step={300} defaultValue={values?.startTime ?? ""} error={fieldErrors?.startTime} />
        <TextField label="끝 (선택)" name="endTime" type="time" step={300} defaultValue={values?.endTime ?? ""} error={fieldErrors?.endTime} />
      </div>
      <TextField label="장소 (선택)" name="placeName" maxLength={80} placeholder="예: 성산일출봉 매표소" defaultValue={values?.placeName ?? ""} />
      <TextField label="주소 (선택)" name="address" maxLength={200} defaultValue={values?.address ?? ""} />
      <TextField label="메모 (선택)" name="memo" maxLength={500} defaultValue={values?.memo ?? ""} />
      <FormMessage state={state} />
      <Button type="submit" variant="secondary" pending={pending}>
        일정 넣기
      </Button>
    </form>
  );
}

export function BudgetForm({ tripId }: { tripId: string }) {
  const { state, formAction, pending, fieldErrors } = useForm(saveBudgetAction);
  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="tripId" value={tripId} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="분류" name="category" options={CATEGORY_OPTIONS} />
        <TextField label="예산 (원)" name="plannedAmount" inputMode="numeric" placeholder="400,000" error={fieldErrors?.plannedAmount} />
      </div>
      <FormMessage state={state} />
      <Button type="submit" variant="secondary" pending={pending}>
        예산 저장
      </Button>
    </form>
  );
}

export function ExpenseForm({ tripId, today }: { tripId: string; today: string }) {
  const { state, formAction, pending, fieldErrors, values } = useForm(addExpenseAction);
  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="tripId" value={tripId} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="지출일" name="spentOn" type="date" defaultValue={values?.spentOn ?? today} error={fieldErrors?.spentOn} />
        <SelectField label="분류" name="category" options={CATEGORY_OPTIONS} defaultValue={values?.category} error={fieldErrors?.category} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="금액 (원)" name="amount" inputMode="numeric" placeholder="85,000" defaultValue={values?.amount ?? ""} error={fieldErrors?.amount} />
        <TextField label="내용 (선택)" name="description" maxLength={100} placeholder="흑돼지" defaultValue={values?.description ?? ""} />
      </div>
      <FormMessage state={state} />
      <Button type="submit" pending={pending}>
        지출 기록
      </Button>
    </form>
  );
}
