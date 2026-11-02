import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Card({ title, description, action, children }: CardProps) {
  return (
    <section className="animate-rise rounded-2xl border border-border bg-surface p-5 shadow-soft">
      {title ? (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-extrabold">{title}</h2>
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
  return <div className="h-32 animate-pulse rounded-2xl border border-border bg-surface shadow-soft" />;
}
