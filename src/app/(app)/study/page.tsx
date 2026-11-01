import type { Metadata } from "next";
import { Suspense } from "react";
import { EducationTabs } from "@/components/education-tabs";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardSkeleton } from "@/components/ui/card";
import { requireFamily } from "@/features/family/queries";
import { deleteStudyRowAction } from "@/features/study/actions";
import { StudyLogForm, SubjectForm } from "@/features/study/components/study-forms";
import { getStudyLogs, getStudySubjects } from "@/features/study/data";
import { formatDotDate } from "@/lib/dates";
import { requestToday } from "@/lib/request-date";

export const metadata: Metadata = { title: "학습" };

const RECENT_LOGS = 20;

async function StudyContent() {
  const [{ children }, subjects, logs, today] = await Promise.all([
    requireFamily(),
    getStudySubjects(),
    getStudyLogs(RECENT_LOGS),
    requestToday(),
  ]);

  return (
    <>
      <Card title="과목별 진도">
        {subjects.length === 0 ? (
          <p className="text-sm text-muted">아래에서 자녀가 공부하는 과목을 추가하세요.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {subjects.map((subject) => (
              <li key={subject.id} className="flex flex-col gap-1.5 py-3">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: subject.child.color }} />
                  <p className="flex-1 font-medium">
                    {subject.child.name} · {subject.name}
                    {subject.textbook ? <span className="ml-1.5 text-sm font-normal text-muted">{subject.textbook}</span> : null}
                  </p>
                  <span className="text-sm tabular-nums text-muted">총 {subject.totalMinutes}분</span>
                </div>
                {subject.latestPercent !== null ? (
                  <div
                    role="progressbar"
                    aria-label={`${subject.name} 진도`}
                    aria-valuenow={subject.latestPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 overflow-hidden rounded-full bg-background"
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${subject.latestPercent}%` }} />
                  </div>
                ) : null}
                <p className="text-sm text-muted">
                  {subject.latestUnit || subject.latestPercent !== null
                    ? `최근 진도 ${subject.latestUnit ?? ""}${subject.latestPercent !== null ? ` ${subject.latestPercent}%` : ""}`
                    : "아직 진도 기록이 없습니다"}
                  {subject.goal ? ` · 목표: ${subject.goal}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {subjects.length > 0 ? (
        <Card title="학습 기록하기">
          <StudyLogForm subjectOptions={subjects.map((s) => ({ id: s.id, name: `${s.child.name} · ${s.name}` }))} today={today} />
        </Card>
      ) : null}

      {logs.length > 0 ? (
        <Card title="최근 학습 기록">
          <ul className="flex flex-col divide-y divide-border text-sm">
            {logs.map((log) => (
              <li key={log.id} className="flex items-start justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">
                    {log.subject.childName} · {log.subject.name}
                  </span>
                  <span className="block text-muted">
                    {formatDotDate(log.studiedOn)}
                    {log.minutes ? ` · ${log.minutes}분` : ""}
                    {log.unit ? ` · ${log.unit}` : ""}
                    {log.progressPercent !== null ? ` ${log.progressPercent}%` : ""}
                    {log.content ? ` · ${log.content}` : ""}
                  </span>
                </span>
                <ActionButton action={deleteStudyRowAction} fields={{ table: "study_logs", id: log.id }} label="삭제" variant="danger" />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {children.length > 0 ? (
        <Card title="과목 추가">
          <SubjectForm childOptions={children.map(({ id, name }) => ({ id, name }))} />
        </Card>
      ) : null}
    </>
  );
}

export default function StudyPage() {
  return (
    <>
      <h1 className="text-xl font-bold">교육</h1>
      <EducationTabs current="study" />
      <Suspense fallback={<CardSkeleton />}>
        <StudyContent />
      </Suspense>
    </>
  );
}
