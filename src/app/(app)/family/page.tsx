import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardSkeleton } from "@/components/ui/card";
import { ChildForm } from "@/features/family/components/child-form";
import { ChildList } from "@/features/family/components/child-list";
import { InvitePanel } from "@/features/family/components/invite-panel";
import { formatExpiry, roleLabel } from "@/features/family/format";
import {
  getActiveInvitation,
  getInviteUrl,
  requireFamily,
  type FamilyContext,
} from "@/features/family/queries";

export const metadata: Metadata = { title: "가족 관리" };

const MAX_PARENTS = 2;

async function InviteSection({ familyId }: { familyId: string }) {
  const invitation = await getActiveInvitation(familyId);
  const panelInvitation = invitation
    ? {
        id: invitation.id,
        url: await getInviteUrl(invitation.code),
        expiresLabel: formatExpiry(invitation.expiresAt),
      }
    : null;
  return <InvitePanel invitation={panelInvitation} />;
}

function MembersCard({ context }: { context: FamilyContext }) {
  const { me, members } = context;
  const full = members.length >= MAX_PARENTS;

  return (
    <Card title="부모" description={full ? "부모 두 명이 모두 등록되었습니다." : "배우자를 초대해 함께 관리하세요."}>
      <ul className="mb-4 flex flex-col divide-y divide-border">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between py-2.5">
            <span className="font-medium">
              {member.display_name}
              {member.id === me.id ? <span className="ml-2 text-sm text-muted">(나)</span> : null}
            </span>
            <span className="text-sm text-muted">{roleLabel(member.role)}</span>
          </li>
        ))}
      </ul>
      {full ? null : (
        <Suspense fallback={<div className="h-24 animate-pulse rounded-xl bg-background" />}>
          <InviteSection familyId={context.family.id} />
        </Suspense>
      )}
    </Card>
  );
}

async function FamilyContent() {
  const context = await requireFamily();

  return (
    <>
      <h1 className="page-title">{context.family.name}</h1>
      <MembersCard context={context} />
      <div id="children" className="scroll-mt-20">
        <Card title="자녀" description="자녀는 로그인 없이 프로필로 관리합니다. 부모 두 사람 모두 수정할 수 있습니다.">
          <ChildList childProfiles={context.children} />
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold">자녀 추가</h3>
            <ChildForm />
          </div>
        </Card>
      </div>
    </>
  );
}

export default function FamilyPage() {
  return (
    <Suspense
      fallback={
        <>
          <CardSkeleton />
          <CardSkeleton />
        </>
      }
    >
      <FamilyContent />
    </Suspense>
  );
}
