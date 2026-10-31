import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Card({ title, description, action, children }: CardProps) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      {title ? (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function CardSkeleton() {
  return <div className="h-32 animate-pulse rounded-2xl border border-border bg-surface" />;
}
