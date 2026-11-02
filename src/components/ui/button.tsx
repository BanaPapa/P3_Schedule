import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  pending?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: "btn-primary",
  secondary:
    "border-[1.5px] border-border-strong bg-surface text-foreground transition hover:bg-surface-2 active:scale-[0.97]",
  danger: "border-[1.5px] border-rose-soft bg-surface text-danger transition hover:bg-rose-soft active:scale-[0.97]",
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
      className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-[15px] font-extrabold disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
