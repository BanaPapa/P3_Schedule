import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/ui/card";
import { AcceptInvitationForm } from "@/features/family/components/accept-invitation-form";
import { getFamilyContext, getInvitationPreview } from "@/features/family/queries";
import { ERROR_MESSAGES } from "@/lib/errors";
import { isInviteCode } from "@/lib/invite-url";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "가족 초대" };

const STATUS_MESSAGES = {
  expired: ERROR_MESSAGES.invitation_expired,
  used: ERROR_MESSAGES.invitation_used,
  revoked: ERROR_MESSAGES.invitation_revoked,
} as const;

function Notice({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <p>{message}</p>
      <Link href={ROUTES.home} className="text-sm font-semibold text-primary">
        홈으로
      </Link>
    </div>
  );
}

async function InviteContent({ params }: { params: PageProps<"/invite/[code]">["params"] }) {
  const { code } = await params;
  if (!isInviteCode(code)) return <Notice message={ERROR_MESSAGES.invitation_not_found} />;

  const context = await getFamilyContext();
  if (context) {
    return <Notice message={`이미 ${context.family.name}에 속해 있어 다른 가족 초대를 수락할 수 없습니다.`} />;
  }

  const preview = await getInvitationPreview(code);
  if (!preview) return <Notice message={ERROR_MESSAGES.invitation_not_found} />;
  if (preview.status !== "valid") return <Notice message={STATUS_MESSAGES[preview.status]} />;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <p>
        {preview.inviterName ? `${preview.inviterName}님이 ` : ""}
        <strong>{preview.familyName}</strong>에 초대했습니다.
      </p>
      <AcceptInvitationForm code={code} familyName={preview.familyName} />
    </div>
  );
}

export default function InvitePage({ params }: PageProps<"/invite/[code]">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-xl font-bold">가족 초대</h1>
      <Suspense fallback={<CardSkeleton />}>
        <InviteContent params={params} />
      </Suspense>
    </main>
  );
}
