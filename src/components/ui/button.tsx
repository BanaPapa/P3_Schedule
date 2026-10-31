import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  pending?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "border border-border bg-surface text-foreground hover:bg-background",
  danger: "border border-border bg-surface text-danger hover:bg-background",
};

export function Button({
  variant = "primary",
  pending = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`inline-flex h-11 items-center justify-center rounded-xl px-4 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
