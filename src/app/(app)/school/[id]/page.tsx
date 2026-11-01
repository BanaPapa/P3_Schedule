import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardSkeleton } from "@/components/ui/card";
import { deleteSchoolEventAction, toggleDoneAction, toggleSupplyAction } from "@/features/school/actions";
import { ScoreForm } from "@/features/school/components/school-forms";
import { eventDateLabel, KIND_LABELS } from "@/features/school/format";
import { getSchoolEvent } from "@/features/school/queries";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "학교 일정" };

type Props = PageProps<"/school/[id]">;

async function EventContent({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getSchoolEvent(id);
  if (!detail) notFound();
  const { event, items } = detail;

  return (
    <>
      <Link href={ROUTES.school} className="text-sm font-semibold text-primary">
        ‹ 학교
      </Link>
      <Card>
        <p className="text-sm font-semibold text-violet-600">{KIND_LABELS[event.kind]}</p>
        <h1 className="text-lg font-bold">{event.title}</h1>
        <p className="text-sm text-muted">
          {event.child.name} · {eventDateLabel(event)}
          {event.subject ? ` · ${event.subject}` : ""}
        </p>
        {event.memo ? <p className="mt-2 text-sm">{event.memo}</p> : null}
        {event.kind === "homework" ? (
          <div className="mt-3">
            <ActionButton
              action={toggleDoneAction}
              fields={{ id: event.id, done: event.done ? "false" : "true" }}
              label={event.done ? "다시 할 일로" : "과제 완료"}
              variant={event.done ? "secondary" : "primary"}
            />
          </div>
        ) : null}
      </Card>

      {items.length > 0 ? (
        <Card title="준비물">
          <ul className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 py-2">
                <span className={item.checked ? "text-muted line-through" : ""}>{item.label}</span>
                <ActionButton
                  action={toggleSupplyAction}
                  fields={{ id: item.id, eventId: event.id, checked: item.checked ? "false" : "true" }}
                  label={item.checked ? "취소" : "챙김"}
                  variant={item.checked ? "secondary" : "primary"}
                />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {event.kind === "exam" ? (
        <Card title="시험 결과">
          <ScoreForm id={event.id} score={event.score} maxScore={event.maxScore} />
        </Card>
      ) : null}

      <ActionButton
        action={deleteSchoolEventAction}
        fields={{ id: event.id }}
        label="이 일정 삭제"
        variant="danger"
        confirmText="이 학교 일정과 준비물을 지울까요?"
      />
    </>
  );
}

export default function SchoolEventPage({ params }: Props) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <EventContent params={params} />
    </Suspense>
  );
}
