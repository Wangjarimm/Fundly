import { useId } from "react";
import { groupThousands, parseDigits } from "../lib/money";

/** Kolom jumlah rupiah dengan pemisah ribuan otomatis; nilai selalu bilangan bulat. */
export function AmountField({
  label,
  value,
  onChange,
  allowNegative,
  autoFocus,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  allowNegative?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const negative = allowNegative && value < 0;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label text-ink">
        {label}
      </label>
      <div className="flex h-[52px] items-center gap-2 rounded-md border border-outline bg-surface px-4 focus-within:border-primary">
        <span className="text-ink-muted">{negative ? "−Rp" : "Rp"}</span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          data-autofocus={autoFocus || undefined}
          value={value === 0 ? "" : groupThousands(value)}
          placeholder="0"
          onChange={(e) => {
            const n = parseDigits(e.target.value);
            onChange(negative || (allowNegative && e.target.value.trim().startsWith("-")) ? -n : n);
          }}
          className="min-w-0 flex-1 bg-transparent text-body tabular outline-none"
        />
      </div>
    </div>
  );
}
