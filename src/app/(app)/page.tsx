import Link from "next/link";
import { Suspense } from "react";
import { Card, CardSkeleton } from "@/components/ui/card";
import { requireFamily } from "@/features/family/queries";
import { ROUTES } from "@/lib/routes";

const MAX_PARENTS = 2;

async function HomeContent() {
  const { family, me, members, children } = await requireFamily();
  const spouseMissing = members.length < MAX_PARENTS;

  return (
    <>
      <div>
        <p className="text-sm text-muted">{me.display_name}님, 안녕하세요</p>
        <h1 className="text-xl font-bold">{family.name}</h1>
      </div>

      {spouseMissing ? (
        <Card title="배우자를 초대하세요" description="함께 쓰면 한 사람이 바꾼 일정과 교육비가 서로에게 바로 보입니다.">
          <Link
            href={ROUTES.family}
            className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground"
          >
            초대 링크 만들기
          </Link>
        </Card>
      ) : null}

      <Card
        title="자녀"
        action={
          <Link href={ROUTES.family} className="text-sm font-semibold text-primary">
            관리
          </Link>
        }
      >
        {children.length === 0 ? (
          <p className="text-sm text-muted">
            아직 등록한 자녀가 없습니다.{" "}
            <Link href={`${ROUTES.family}#children`} className="font-semibold text-primary">
              자녀 등록하기
            </Link>
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {children.map((child) => (
              <li
                key={child.id}
                className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm"
              >
                <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: child.color }} />
                {child.name}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="구성원">
        <ul className="flex flex-wrap gap-2 text-sm">
          {members.map((member) => (
            <li key={member.id} className="rounded-full bg-background px-3 py-1.5">
              {member.display_name}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <>
          <CardSkeleton />
          <CardSkeleton />
        </>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
