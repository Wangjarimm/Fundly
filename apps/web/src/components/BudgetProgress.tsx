import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import type { Budget } from "../api/hooks";
import { formatRupiah } from "../lib/money";
import { cn } from "../lib/cn";

// Status tidak hanya lewat warna: ikon + teks (F-06 KP2, DESIGN.md).
const STATUS = {
  safe: { label: "Aman", icon: CircleCheck, text: "text-income", bar: "bg-income" },
  near: { label: "Hampir habis", icon: TriangleAlert, text: "text-warning", bar: "bg-warning" },
  over: { label: "Terlampaui", icon: CircleAlert, text: "text-expense", bar: "bg-expense" },
} as const;

export function BudgetProgress({ budget }: { budget: Pick<Budget, "spent" | "limit_amount" | "status"> }) {
  const s = STATUS[budget.status];
  const pct = budget.limit_amount > 0 ? Math.min(100, (budget.spent / budget.limit_amount) * 100) : 100;
  const remaining = budget.limit_amount - budget.spent;
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={budget.limit_amount}
        aria-valuenow={Math.min(budget.spent, budget.limit_amount)}
        aria-valuetext={`${formatRupiah(budget.spent)} dari ${formatRupiah(budget.limit_amount)}, ${s.label}`}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-variant"
      >
        <div className={cn("h-full rounded-full transition-[width] duration-200", s.bar)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className={cn("inline-flex items-center gap-1 text-label", s.text)}>
          <s.icon aria-hidden className="size-4" /> {s.label}
        </span>
        <span className="text-body-small tabular text-ink-muted">
          {formatRupiah(budget.spent)} / {formatRupiah(budget.limit_amount)}
        </span>
      </div>
      <span className="text-body-small text-ink-muted">
        {remaining >= 0 ? `Sisa ${formatRupiah(remaining)}` : `Lebih ${formatRupiah(-remaining)}`}
      </span>
    </div>
  );
}
