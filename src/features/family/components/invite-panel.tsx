"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { IDLE, type FormState } from "@/lib/form-state";
import { createInvitationAction, revokeInvitationAction } from "../actions";

interface InvitePanelProps {
  invitation: { id: string; url: string; expiresLabel: string } | null;
}

type CopyStatus = "idle" | "copied" | "failed";

export function InvitePanel({ invitation }: InvitePanelProps) {
  const [createState, createAction, creating] = useActionState<FormState, FormData>(
    createInvitationAction,
    IDLE,
  );
  const [revokeState, revokeAction, revoking] = useActionState<FormState, FormData>(
    revokeInvitationAction,
    IDLE,
  );
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  async function share(url: string) {
    const shareData = { title: "Family Hub 가족 초대", text: "우리 가족에 합류해 주세요.", url };
    try {
      if (typeof navigator.share === "function" && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopyStatus("copied");
    } catch (error) {
      // 사용자가 공유 창을 닫은 경우는 실패가 아니다
      if (error instanceof DOMException && error.name === "AbortError") return;
      setCopyStatus("failed");
    }
  }

  if (!invitation) {
    return (
      <form action={createAction} className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          링크를 만들어 배우자에게 보내세요. 배우자가 가입 후 링크를 열면 가족에 합류합니다.
        </p>
        <FormMessage state={createState} />
        <Button type="submit" pending={creating}>
          {creating ? "만드는 중…" : "초대 링크 만들기"}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        초대 링크
        <input
          readOnly
          value={invitation.url}
          onFocus={(event) => event.currentTarget.select()}
          className="h-11 rounded-xl border border-border bg-background px-3 font-mono text-xs"
        />
      </label>
      <p className="text-sm text-muted">{invitation.expiresLabel} 사용할 수 있고, 한 번만 쓸 수 있습니다.</p>
      <div className="flex gap-2">
        <Button type="button" className="flex-1" onClick={() => share(invitation.url)}>
          링크 보내기
        </Button>
        <form action={revokeAction}>
          <input type="hidden" name="id" value={invitation.id} />
          <Button type="submit" variant="danger" pending={revoking}>
            취소
          </Button>
        </form>
      </div>
      {copyStatus === "copied" ? (
        <p role="status" className="text-sm text-success">
          링크를 복사했습니다. 메신저에 붙여 넣어 보내세요.
        </p>
      ) : null}
      {copyStatus === "failed" ? (
        <p role="alert" className="text-sm text-danger">
          복사하지 못했습니다. 링크를 길게 눌러 직접 복사해 주세요.
        </p>
      ) : null}
      <FormMessage state={revokeState} />
    </div>
  );
}
