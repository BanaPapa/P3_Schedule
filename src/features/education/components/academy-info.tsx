"use client";

import { useActionState, useCallback, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { IDLE, type FormState } from "@/lib/form-state";
import { deleteAcademyAction } from "../actions";
import type { Academy } from "../queries";
import { AcademyForm } from "./academy-form";

/** 학원 상세의 기본 정보. 수정과 삭제(삭제하면 관리 화면으로 돌아간다). */
export function AcademyInfo({ academy }: { academy: Academy }) {
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
    return <AcademyForm academy={academy} onResult={handleResult} onCancel={() => setEditing(false)} />;
  }

  const details = [academy.phone, academy.contact_name].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm">
        <p>{details || <span className="text-muted">연락처가 없습니다.</span>}</p>
        {academy.memo ? <p className="mt-1 text-muted">{academy.memo}</p> : null}
      </div>
      <div className="flex gap-2">
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
            학원 삭제
          </Button>
        </form>
      </div>
      <FormMessage state={notice} />
      <FormMessage state={deleteState} />
    </div>
  );
}
