import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <p className="text-lg font-semibold">찾는 화면이 없습니다</p>
      <p className="text-sm text-muted">지워졌거나 우리 가족의 정보가 아닐 수 있습니다.</p>
      <Link href={ROUTES.home} className="font-semibold text-primary">
        홈으로
      </Link>
    </main>
  );
}
