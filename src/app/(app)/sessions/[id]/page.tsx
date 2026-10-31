import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, CardSkeleton } from "@/components/ui/card";
import { SESSION_KIND_LABELS, SESSION_STATUS_LABELS } from "@/features/education/format";
import { createMakeupAction, rescheduleSessionAction } from "@/features/sessions/actions";
import { SessionNoteForm, WaiveMakeupForm } from "@/features/sessions/components/session-extras";
import { SlotForm } from "@/features/sessions/components/slot-form";
import { StatusActions } from "@/features/sessions/components/status-actions";
import { getSessionDetail, type SessionSummary } from "@/features/sessions/queries";
import { formatDayLabel, formatTime } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";
import { z } from "zod";

export const metadata: Metadata = { title: "수업" };

const CHANGEABLE = new Set(["scheduled", "makeup_scheduled"]);
const MISSED = new Set(["absent", "academy_cancelled"]);

function summaryLabel(session: SessionSummary): string {
  return `${formatDayLabel(session.date)} ${formatTime(session.startTime)}–${formatTime(session.endTime)}`;
}

function LinkedSession({ label, session }: { label: string; session: SessionSummary }) {
  return (
    <Link
      href={ROUTES.session(session.id)}
      className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2 text-sm"
    >
      <span>
        <span className="text-muted">{label}</span> {summaryLabel(session)}
      </span>
      <span className="shrink-0 text-muted">{SESSION_STATUS_LABELS[session.status]}</span>
    </Link>
  );
}

async function SessionContent({ params }: { params: PageProps<"/sessions/[id]">["params"] }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const session = await getSessionDetail(id);
  if (!session) notFound();

  const kindLabel = SESSION_KIND_LABELS[session.kind];
  const liveReplacement = session.replacements.find((item) => item.status !== "cancelled");
  const canGetMakeup = session.kind !== "makeup" && MISSED.has(session.status) && !liveReplacement;
  const slot = { id: session.id, version: session.version };
  const defaults = { date: session.date, startTime: formatTime(session.startTime), endTime: formatTime(session.endTime) };

  return (
    <>
      <Link href={`${ROUTES.calendar}?date=${session.date}`} className="text-sm font-semibold text-primary">
        ‹ 캘린더
      </Link>

      <Card>
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-2 size-3 shrink-0 rounded-full" style={{ backgroundColor: session.child.color }} />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold">
              {session.child.name} · {session.subject}
              {kindLabel ? <span className="ml-2 text-sm font-semibold text-primary">{kindLabel}</span> : null}
            </h1>
            <p className="text-sm text-muted">{session.academyName}</p>
            <p className="mt-2">{summaryLabel(session)}</p>
          </div>
          <span className="shrink-0 rounded-full bg-background px-3 py-1 text-sm font-semibold">
            {SESSION_STATUS_LABELS[session.status]}
          </span>
        </div>
        {session.origin || session.replacements.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2">
            {session.origin ? <LinkedSession label="원래 수업" session={session.origin} /> : null}
            {session.replacements.map((item) => (
              <LinkedSession key={item.id} label={SESSION_KIND_LABELS[item.kind] ?? "수업"} session={item} />
            ))}
          </div>
        ) : null}
      </Card>

      <Card title="상태 바꾸기">
        <StatusActions id={session.id} version={session.version} kind={session.kind} status={session.status} />
      </Card>

      {canGetMakeup ? (
        <Card
          title="보강"
          description={session.makeupWaived ? "보강 안 함으로 표시했습니다." : "보강 날짜가 정해지면 등록하세요. 보강 대기 목록에서 빠집니다."}
        >
          <div className="flex flex-col gap-4">
            {session.makeupWaived ? null : (
              <SlotForm {...slot} action={createMakeupAction} submitLabel="보강 등록" defaults={defaults} />
            )}
            <WaiveMakeupForm {...slot} waived={session.makeupWaived} />
          </div>
        </Card>
      ) : null}

      {CHANGEABLE.has(session.status) ? (
        <Card
          title="이번 수업만 변경"
          description={
            session.kind === "regular"
              ? "다른 날로 옮기면 원래 수업은 취소로 남고 새 날짜에 수업이 생깁니다."
              : "이 수업의 날짜와 시간을 바꿉니다."
          }
        >
          <SlotForm {...slot} action={rescheduleSessionAction} submitLabel="이번 수업만 변경" defaults={defaults} />
          {session.kind === "regular" ? (
            <p className="mt-3 text-sm text-muted">
              매주 시간이 바뀌었다면{" "}
              <Link href={ROUTES.scheduleChange(session.enrollmentId)} className="font-semibold text-primary">
                앞으로 전체 변경
              </Link>
              을 이용하세요.
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <SessionNoteForm {...slot} note={session.note} />
      </Card>
    </>
  );
}

export default function SessionPage({ params }: PageProps<"/sessions/[id]">) {
  return (
    <Suspense
      fallback={
        <>
          <CardSkeleton />
          <CardSkeleton />
        </>
      }
    >
      <SessionContent params={params} />
    </Suspense>
  );
}
