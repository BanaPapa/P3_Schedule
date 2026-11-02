import Link from "next/link";
import { ROUTES } from "@/lib/routes";

interface AcademySummary {
  id: string;
  name: string;
  /** 지금 수강 중인 과목 수 */
  activeCount: number;
}

/** 관리 화면의 학원 목록. 누르면 학원 상세(수강 과목 추가)로 간다. */
export function AcademyList({ academies }: { academies: AcademySummary[] }) {
  if (academies.length === 0) {
    return <p className="text-sm text-muted">아직 등록한 학원이 없습니다. 아래에서 학원을 추가하세요.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {academies.map((academy) => (
        <li key={academy.id}>
          <Link href={ROUTES.academy(academy.id)} className="flex items-center gap-3 py-3">
            <span className="min-w-0 flex-1 truncate font-medium">{academy.name}</span>
            <span className="text-sm text-muted">
              {academy.activeCount > 0 ? `수강 중 ${academy.activeCount}과목` : "수강 과목 없음"}
            </span>
            <span aria-hidden className="text-muted">
              ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
