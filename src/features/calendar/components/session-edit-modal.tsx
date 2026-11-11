"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import { formatDayLabel, isoWeekday, isIsoDate, WEEKDAY_LABELS } from "@/lib/dates";
import { IDLE } from "@/lib/form-state";
import { editSessionAction } from "../actions";
import { CHILD_CHANGE_NEEDS_WEEKLY, type EditScope } from "../edit-schemas";
import type { CalendarSession } from "../queries";
import type { ChildOption } from "./timetable-editor";

/** 끌어 놓은 자리(또는 편집 시작값) */
export interface EditDraft {
  date: string;
  childId: string;
  startTime: string;
  endTime: string;
}

interface Props {
  session: CalendarSession;
  draft?: EditDraft;
  fromDrag: boolean;
  childOptions: readonly ChildOption[];
  onClose: () => void;
}

const hhmm = (time: string) => time.slice(0, 5);

function ScopeOption({
  value,
  checked,
  disabled,
  title,
  detail,
  onSelect,
}: {
  value: EditScope;
  checked: boolean;
  disabled: boolean;
  title: string;
  detail: string;
  onSelect: (value: EditScope) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border-[1.5px] px-3 py-2.5 ${checked ? "border-primary bg-primary-soft" : "border-border"} ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
    >
      <input
        type="radio"
        name="scope"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(value)}
        className="mt-1 accent-[var(--primary)]"
      />
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-muted">{detail}</span>
      </span>
    </label>
  );
}

/** 더블클릭 편집·끌어 옮기기 확인. 이번만 / 앞으로 매주 중에서 고른다(반복 수업 규칙) */
export function SessionEditModal({ session, draft, fromDrag, childOptions, onClose }: Props) {
  const [state, formAction, pending] = useActionState(editSessionAction, IDLE);
  const [childId, setChildId] = useState(draft?.childId ?? session.child.id);
  const [date, setDate] = useState(draft?.date ?? session.date);
  const regular = session.kind === "regular";
  const childChanged = childId !== session.child.id;
  const targetChildName = childOptions.find((child) => child.id === childId)?.name ?? "";
  const [scope, setScope] = useState<EditScope>(childChanged ? "weekly" : "once");
  // 아이를 바꾸면 "앞으로 매주"만 된다
  const effectiveScope: EditScope = childChanged ? "weekly" : scope;

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state, onClose]);

  const values = state.status === "error" ? state.values : undefined;
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const weekday = isIsoDate(date) ? WEEKDAY_LABELS[isoWeekday(date)] : "";
  const original = `${session.child.name} · ${session.academyName} · ${formatDayLabel(session.date)} ${hhmm(session.startTime)}–${hhmm(session.endTime)}`;

  return (
    <Modal
      title={fromDrag ? "수업 옮기기" : "수업 바꾸기"}
      description={<>지금: {original}</>}
      onClose={onClose}
    >
      {/* action= 대신 직접 보낸다: React 가 제출 후 폼을 초기화하면 라디오 표시와 고른 범위가 어긋난다 */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="id" value={session.id} />
        <input type="hidden" name="version" value={session.version} />
        <input type="hidden" name="originalChildId" value={session.child.id} />
        <input type="hidden" name="childId" value={childId} />

        {childOptions.length > 1 ? (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[length:calc(13px+var(--fs-up))] font-extrabold text-muted">아이</legend>
            <div className="flex flex-wrap gap-2">
              {childOptions.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  aria-pressed={childId === child.id}
                  disabled={!regular && child.id !== session.child.id}
                  onClick={() => setChildId(child.id)}
                  className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-sm font-bold disabled:opacity-40 ${childId === child.id ? "border-primary bg-primary-soft" : "border-border"}`}
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: child.color }} aria-hidden />
                  {child.name}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        <TextField
          label="날짜"
          name="date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          error={errors?.date}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="시작"
            name="startTime"
            type="time"
            step={600}
            defaultValue={values?.startTime ?? draft?.startTime ?? hhmm(session.startTime)}
            error={errors?.startTime}
            required
          />
          <TextField
            label="끝"
            name="endTime"
            type="time"
            step={600}
            defaultValue={values?.endTime ?? draft?.endTime ?? hhmm(session.endTime)}
            error={errors?.endTime}
            required
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-[length:calc(13px+var(--fs-up))] font-extrabold text-muted">적용 범위</legend>
          <ScopeOption
            value="once"
            checked={effectiveScope === "once"}
            disabled={childChanged}
            title="이번만"
            detail={childChanged ? CHILD_CHANGE_NEEDS_WEEKLY : `${formatDayLabel(session.date)} 수업만 바꿉니다.`}
            onSelect={setScope}
          />
          <ScopeOption
            value="weekly"
            checked={effectiveScope === "weekly"}
            disabled={!regular}
            title="앞으로 매주"
            detail={
              !regular
                ? "보강·변경된 수업은 이번만 바꿀 수 있습니다."
                : `이 수업(매주 ${WEEKDAY_LABELS[isoWeekday(session.date)]} ${hhmm(session.startTime)})을 앞으로 매주 ${weekday ? `${weekday}요일 ` : ""}${
                    childChanged ? `${targetChildName} 수업으로 옮깁니다` : "새 시간으로 바꿉니다"
                  }. 지난 기록은 그대로 둡니다.`
            }
            onSelect={setScope}
          />
          {errors?.scope ? <p className="text-sm text-danger">{errors.scope}</p> : null}
        </fieldset>

        <FormMessage state={state} />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" pending={pending}>
            저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}
