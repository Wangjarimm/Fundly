import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { cn } from "../lib/cn";

// Komponen dasar mengikuti token komponen di DESIGN.md.

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary h-[52px] px-6 hover:brightness-110",
  secondary: "bg-primary-container text-on-primary-container h-12 px-5 hover:brightness-95",
  ghost: "text-primary h-12 px-3 hover:bg-surface-variant",
  danger: "text-expense h-12 px-4 hover:bg-expense-container",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading, block, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md text-label font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        buttonStyles[variant],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading && <LoaderCircle aria-hidden className="size-5 animate-spin" />}
      {children}
    </button>
  );
});

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

/** Kolom isian: label selalu tampak di atas, error di bawah dengan ikon. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const msgId = `${inputId}-msg`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-label text-ink">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? msgId : undefined}
        className={cn(
          "h-[52px] w-full rounded-md border bg-surface px-4 text-body text-ink placeholder:text-ink-muted/70",
          error ? "border-expense" : "border-outline focus:border-primary",
        )}
        {...rest}
      />
      {error ? (
        <p id={msgId} className="flex items-start gap-1.5 text-body-small text-expense">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-body-small text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-md border border-outline bg-surface p-4", className)}>{children}</div>;
}

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  suggested?: boolean;
}

export function Chip({ selected, suggested, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-label transition",
        selected
          ? "bg-primary text-on-primary"
          : suggested
            ? "bg-primary-container text-on-primary-container"
            : "bg-surface-variant text-ink hover:brightness-95",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ label = "Memuat…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-8 text-ink-muted">
      <LoaderCircle aria-hidden className="size-5 animate-spin" />
      <span className="text-body-small">{label}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-variant", className)} />;
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex min-h-12 items-center justify-between gap-3">
      <h1 className="text-headline text-ink">{children}</h1>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-start gap-3">
      <p className="flex items-start gap-2 text-body text-ink">
        <CircleAlert aria-hidden className="mt-1 size-5 shrink-0 text-expense" />
        {message}
      </p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </Card>
  );
}
