import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonth, monthLabel, shiftMonth } from "../lib/date";

/** Pindah bulan dengan panah kiri/kanan (F-05 KP5). Bulan depan tidak bisa dipilih. */
export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const atCurrent = month >= currentMonth();
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-outline bg-surface p-1">
      <button
        type="button"
        aria-label="Bulan sebelumnya"
        onClick={() => onChange(shiftMonth(month, -1))}
        className="flex size-12 items-center justify-center rounded-sm hover:bg-surface-variant"
      >
        <ChevronLeft aria-hidden className="size-5" />
      </button>
      <span className="text-title text-ink" aria-live="polite">
        {monthLabel(month)}
      </span>
      <button
        type="button"
        aria-label="Bulan berikutnya"
        disabled={atCurrent}
        onClick={() => onChange(shiftMonth(month, 1))}
        className="flex size-12 items-center justify-center rounded-sm hover:bg-surface-variant disabled:opacity-40"
      >
        <ChevronRight aria-hidden className="size-5" />
      </button>
    </div>
  );
}
