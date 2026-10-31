import { formatRelative } from "@/lib/dates";
import type { HistoryItem } from "../queries";

interface HistoryListProps {
  items: HistoryItem[];
  now: Date;
}

export function HistoryList({ items, now }: HistoryListProps) {
  if (items.length === 0) return <p className="text-sm text-muted">아직 변경 이력이 없습니다.</p>;
  return (
    <ol className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <li key={item.id} className="py-2.5">
          <p className="text-sm">{item.text}</p>
          <p className="text-xs text-muted">
            <span className={item.mine ? "" : "font-semibold text-primary"}>{item.mine ? "나" : item.actorName}</span>
            {" · "}
            <time dateTime={item.createdAt}>{formatRelative(item.createdAt, now)}</time>
          </p>
        </li>
      ))}
    </ol>
  );
}
