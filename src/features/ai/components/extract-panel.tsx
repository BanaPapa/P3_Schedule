"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { formatDayLabel } from "@/lib/dates";
import { IDLE, type FormState } from "@/lib/form-state";
import { ROUTES } from "@/lib/routes";
import { KIND_LABELS, SCHOOL_KINDS, type SchoolKind } from "@/features/school/format";
import { extractScheduleAction, registerSuggestionsAction, type ExtractState } from "../actions";
import type { SchoolSuggestion } from "../suggestions";

interface ChildOption {
  id: string;
  name: string;
}

const INPUT =
  "h-10 min-w-0 rounded-lg border border-border bg-surface px-2 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft";

interface EditableSuggestion extends SchoolSuggestion {
  key: number;
  selected: boolean;
  suppliesText: string;
}

function toEditable(items: SchoolSuggestion[], children: ChildOption[]): EditableSuggestion[] {
  return items.map((item, index) => ({
    ...item,
    // 자녀가 한 명이면 그 자녀로 채운다. 여럿인데 모르면 부모가 고른다.
    childId: item.childId ?? (children.length === 1 ? children[0].id : null),
    key: index,
    selected: true,
    suppliesText: item.supplies.join(", "),
  }));
}

function toPayload(item: EditableSuggestion): string {
  return JSON.stringify({
    childId: item.childId,
    kind: item.kind,
    eventDate: item.eventDate,
    endDate: item.endDate || null,
    title: item.title,
    subject: item.subject,
    supplies: item.suppliesText.split(",").map((supply) => supply.trim()).filter(Boolean),
    note: item.note,
  });
}

/** AI 가 찾은 일정 후보. 부모가 고치고 고른 것만 등록된다. */
function SuggestionReview({ initial, childOptions }: { initial: SchoolSuggestion[]; childOptions: ChildOption[] }) {
  const [items, setItems] = useState(() => toEditable(initial, childOptions));
  const [state, formAction, pending] = useActionState<FormState, FormData>(registerSuggestionsAction, IDLE);
  const selected = items.filter((item) => item.selected);
  const missingChild = selected.some((item) => !item.childId);

  function update(key: number, patch: Partial<EditableSuggestion>) {
    setItems(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {selected.map((item) => (
        <input key={item.key} type="hidden" name="item" value={toPayload(item)} />
      ))}
      <ul className="flex flex-col gap-3">
        {items.map((item, index) => (
          <li key={item.key} className={`flex flex-col gap-2 rounded-xl border p-3 ${item.selected ? "border-primary" : "border-border opacity-60"}`}>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={item.selected}
                onChange={(event) => update(item.key, { selected: event.target.checked })}
                className="size-4 accent-primary"
              />
              {index + 1}번째 후보 등록
            </label>
            <input
              aria-label={`${index + 1}번째 후보 제목`}
              value={item.title}
              maxLength={80}
              onChange={(event) => update(item.key, { title: event.target.value })}
              className={INPUT}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label={`${index + 1}번째 후보 자녀`}
                value={item.childId ?? ""}
                onChange={(event) => update(item.key, { childId: event.target.value || null })}
                className={INPUT}
              >
                <option value="">자녀 선택</option>
                {childOptions.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </select>
              <select
                aria-label={`${index + 1}번째 후보 종류`}
                value={item.kind}
                onChange={(event) => update(item.key, { kind: event.target.value as SchoolKind })}
                className={INPUT}
              >
                {SCHOOL_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
              <input
                type="date"
                aria-label={`${index + 1}번째 후보 날짜`}
                value={item.eventDate}
                onChange={(event) => update(item.key, { eventDate: event.target.value })}
                className={INPUT}
              />
              <input
                type="date"
                aria-label={`${index + 1}번째 후보 끝나는 날`}
                value={item.endDate ?? ""}
                onChange={(event) => update(item.key, { endDate: event.target.value || null })}
                className={INPUT}
              />
            </div>
            <input
              aria-label={`${index + 1}번째 후보 준비물`}
              placeholder="준비물 (쉼표로 구분)"
              value={item.suppliesText}
              onChange={(event) => update(item.key, { suppliesText: event.target.value })}
              className={INPUT}
            />
            {item.note ? <p className="text-sm text-muted">{item.note}</p> : null}
          </li>
        ))}
      </ul>
      {missingChild ? <p className="text-sm text-danger">고른 항목마다 자녀를 정해 주세요.</p> : null}
      <FormMessage state={state} />
      <Button type="submit" pending={pending} disabled={selected.length === 0 || missingChild}>
        {`고른 ${selected.length}개를 학교 일정으로 등록`}
      </Button>
    </form>
  );
}

export function ExtractPanel({ childOptions }: { childOptions: ChildOption[] }) {
  const [state, formAction, pending] = useActionState<ExtractState, FormData>(extractScheduleAction, { status: "idle" });

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          안내문 글
          <textarea
            name="text"
            rows={6}
            maxLength={5000}
            placeholder="가정통신문, 알림장, 학원 문자를 붙여 넣으세요."
            className="rounded-xl border-[1.5px] border-border-strong bg-surface px-3 py-2 text-base font-normal outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          또는 사진
          <input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" className="text-sm" />
        </label>
        <p className="text-xs text-muted">
          글과 사진은 일정을 찾기 위해 AI 서비스(Anthropic Claude)로 보내집니다. 찾은 일정은 확인한 것만 등록됩니다.
        </p>
        <Button type="submit" pending={pending}>
          {pending ? "읽는 중…" : "일정 찾기"}
        </Button>
      </form>

      {state.status === "error" ? <FormMessage state={{ status: "error", message: state.message }} /> : null}

      {state.status === "done" ? (
        <section aria-label="찾은 일정" className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">
            찾은 학교 일정 {state.schoolItems.length}개
            {state.remaining !== null ? <span className="ml-2 font-normal text-muted">오늘 남은 횟수 {state.remaining}</span> : null}
          </h3>
          {state.schoolItems.length > 0 ? (
            <SuggestionReview key={JSON.stringify(state.schoolItems)} initial={state.schoolItems} childOptions={childOptions} />
          ) : (
            <p className="text-sm text-muted">등록할 학교 일정을 찾지 못했습니다.</p>
          )}
          {state.reviewItems.length > 0 ? (
            <div className="rounded-xl bg-background p-3">
              <h4 className="mb-1 text-sm font-semibold">직접 확인할 것</h4>
              <p className="mb-2 text-xs text-muted">학원 변경이나 날짜가 분명하지 않은 내용은 자동으로 바꾸지 않습니다.</p>
              <ul className="flex flex-col gap-1 text-sm">
                {state.reviewItems.map((item, index) => (
                  <li key={index}>
                    {item.date ? (
                      <Link href={`${ROUTES.calendar}?date=${item.date}`} className="font-medium text-primary">
                        {formatDayLabel(item.date)}
                      </Link>
                    ) : null}{" "}
                    {item.title}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
