"use client";

import { useActionState, useCallback, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { IDLE, type FormState } from "@/lib/form-state";
import { deleteChildAction } from "../actions";
import { formatBirthDate } from "../format";
import type { Child } from "../queries";
import { ChildForm } from "./child-form";

interface ChildListProps {
  childProfiles: Child[];
}

export function ChildList({ childProfiles }: ChildListProps) {
  if (childProfiles.length === 0) {
    return <p className="text-sm text-muted">아직 등록한 자녀가 없습니다.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {childProfiles.map((child) => (
        <ChildRow key={child.id} child={child} />
      ))}
    </ul>
  );
}

function ChildRow({ child }: { child: Child }) {
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<FormState>(IDLE);
  const [deleteState, deleteAction, deleting] = useActionState<FormState, FormData>(
    deleteChildAction,
    IDLE,
  );
  const birthDate = formatBirthDate(child.birth_date);

  // 성공했거나 배우자가 먼저 수정했으면 편집을 닫고 최신 값 위에 결과를 보여준다
  const handleResult = useCallback((state: FormState) => {
    if (state.status === "success" || (state.status === "error" && state.code === "conflict")) {
      setEditing(false);
      setNotice(state);
    }
  }, []);

  function startEditing() {
    setNotice(IDLE);
    setEditing(true);
  }

  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(`${child.name}의 프로필을 삭제할까요?`)) event.preventDefault();
  }

  if (editing) {
    return (
      <li className="py-3">
        <ChildForm child={child} onResult={handleResult} onCancel={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: child.color }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{child.name}</p>
          {birthDate ? <p className="text-sm text-muted">{birthDate}</p> : null}
        </div>
        <Button type="button" variant="secondary" className="h-9 px-3 text-sm" onClick={startEditing}>
          수정
        </Button>
        <form action={deleteAction} onSubmit={confirmDelete}>
          <input type="hidden" name="id" value={child.id} />
          <input type="hidden" name="version" value={child.version} />
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
