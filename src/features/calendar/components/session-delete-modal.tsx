"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Modal } from "@/components/ui/modal";
import { formatDayLabel, isoWeekday, WEEKDAY_LABELS } from "@/lib/dates";
import { IDLE } from "@/lib/form-state";
import { deleteSessionAction } from "../actions";
import type { EditScope } from "../edit-schemas";
import type { CalendarSession } from "../queries";

const hhmm = (time: string) => time.slice(0, 5);

/** 우클릭 → 삭제. 이번만은 취소로 남기고(기록·학원비 계산), 앞으로 매주는 그 요일·시간 수업을 없앤다 */
export function SessionDeleteModal({ session, onClose }: { session: CalendarSession; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(deleteSessionAction, IDLE);
  const regular = session.kind === "regular";
  const [scope, setScope] = useState<EditScope>("once");

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state, onClose]);

  const options: { value: EditScope; title: string; detail: string; disabled: boolean }[] = [
    {
      value: "once",
      title: "이번만",
      detail: `${formatDayLabel(session.date)} 수업만 취소합니다. 기록에는 '취소'로 남습니다.`,
      disabled: false,
    },
    {
      value: "weekly",
      title: "앞으로 매주",
      detail: regular
        ? `매주 ${WEEKDAY_LABELS[isoWeekday(session.date)]} ${hhmm(session.startTime)} 수업을 앞으로 없앱니다. 지난 기록은 그대로 둡니다.`
        : "보강·변경된 수업은 이번만 취소할 수 있습니다.",
      disabled: !regular,
    },
  ];

  return (
    <Modal
      title="수업 삭제"
      description={`${session.child.name} · ${session.academyName} · ${formatDayLabel(session.date)} ${hhmm(session.startTime)}–${hhmm(session.endTime)}`}
      onClose={onClose}
    >
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={session.id} />
        <input type="hidden" name="version" value={session.version} />
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">삭제 범위</legend>
          {options.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-xl border-[1.5px] px-3 py-2.5 ${scope === option.value ? "border-danger bg-rose-soft" : "border-border"} ${option.disabled ? "cursor-not-allowed opacity-45" : ""}`}
            >
              <input
                type="radio"
                name="scope"
                value={option.value}
                checked={scope === option.value}
                disabled={option.disabled}
                onChange={() => setScope(option.value)}
                className="mt-1 accent-[var(--danger)]"
              />
              <span>
                <span className="block text-sm font-bold">{option.title}</span>
                <span className="block text-xs text-muted">{option.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <FormMessage state={state} />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            닫기
          </Button>
          <Button type="submit" variant="danger" pending={pending}>
            삭제
          </Button>
        </div>
      </form>
    </Modal>
  );
}
