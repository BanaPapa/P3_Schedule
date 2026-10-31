"use client";

import { useActionState, useCallback, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { IDLE, type FormState } from "@/lib/form-state";
import { deleteAcademyAction } from "../actions";
import type { Academy } from "../queries";
import { AcademyForm } from "./academy-form";

interface AcademyListProps {
  academies: Academy[];
}

export function AcademyList({ academies }: AcademyListProps) {
  if (academies.length === 0) {
    return <p className="text-sm text-muted">아직 등록한 학원이 없습니다.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {academies.map((academy) => (
        <AcademyRow key={academy.id} academy={academy} />
      ))}
    </ul>
  );
}

function AcademyRow({ academy }: { academy: Academy }) {
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<FormState>(IDLE);
  const [deleteState, deleteAction, deleting] = useActionState<FormState, FormData>(
    deleteAcademyAction,
    IDLE,
  );

  // 성공했거나 배우자가 먼저 수정했으면 편집을 닫고 최신 값 위에 결과를 보여준다
  const handleResult = useCallback((state: FormState) => {
    if (state.status === "success" || (state.status === "error" && state.code === "conflict")) {
      setEditing(false);
      setNotice(state);
    }
  }, []);

  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(`${academy.name}을(를) 삭제할까요?`)) event.preventDefault();
  }

  if (editing) {
    return (
      <li className="py-3">
        <AcademyForm academy={academy} onResult={handleResult} onCancel={() => setEditing(false)} />
      </li>
    );
  }

  const details = [academy.phone, academy.contact_name].filter(Boolean).join(" · ");

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{academy.name}</p>
          {details ? <p className="text-sm text-muted">{details}</p> : null}
          {academy.memo ? <p className="text-sm text-muted">{academy.memo}</p> : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="h-9 px-3 text-sm"
          onClick={() => {
            setNotice(IDLE);
            setEditing(true);
          }}
        >
          수정
        </Button>
        <form action={deleteAction} onSubmit={confirmDelete}>
          <input type="hidden" name="id" value={academy.id} />
          <input type="hidden" name="version" value={academy.version} />
          <Button type="submit" variant="danger" className="h-9 px-3 text-sm" pending={deleting}>
            삭제
          </Button>
        </form>
      </div>
      <FormMessage state={notice} />
      <FormMessage state={deleteState} />
    </li>
  );
}
