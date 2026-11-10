import { isAutoLoginEnabled } from "@/lib/auto-login";
import { getFamilyContext } from "@/features/family/queries";
import { RealtimeRefresher } from "./realtime-refresher";

/** 가족이 있을 때만 실시간 구독을 켠다 (레이아웃의 Suspense 안에서 쓴다) */
export async function RealtimeSync() {
  const context = await getFamilyContext();
  if (!context) return null;
  const memberNames = Object.fromEntries(context.members.map((member) => [member.user_id, member.display_name]));
  return (
    <RealtimeRefresher
      familyId={context.family.id}
      userId={context.user.id}
      memberNames={memberNames}
      sharedAccount={isAutoLoginEnabled()}
    />
  );
}
