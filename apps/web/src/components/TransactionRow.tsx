import { CloudOff } from "lucide-react";
import type { Category, Transaction, Wallet } from "../api/hooks";
import { formatSigned } from "../lib/money";
import { cn } from "../lib/cn";
import { CategoryIcon } from "./CategoryIcon";

export function TransactionRow({
  tx,
  wallet,
  category,
  pending,
  onSelect,
}: {
  tx: Pick<Transaction, "id" | "kind" | "amount" | "merchant" | "note">;
  wallet?: Wallet;
  category?: Category;
  pending?: boolean;
  onSelect?: () => void;
}) {
  const title = tx.merchant || category?.name || (tx.kind === "income" ? "Uang masuk" : "Uang keluar");
  const meta = [wallet?.name, category?.name ?? "Tanpa kategori"].filter(Boolean).join(" · ");
  const amount = formatSigned(tx.amount, tx.kind);
  const content = (
    <>
      <CategoryIcon icon={category?.icon} tone={category?.color_token} kind={tx.kind} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-title text-ink">{title}</span>
        <span className="block truncate text-body-small text-ink-muted">
          {meta}
          {pending && (
            <span className="ml-1 inline-flex items-center gap-1 text-warning">
              <CloudOff aria-hidden className="size-3.5" /> Menunggu sinkron
            </span>
          )}
        </span>
      </span>
      <span
        className={cn("shrink-0 pl-2 text-right text-title tabular", tx.kind === "income" ? "text-income" : "text-expense")}
      >
        {amount}
      </span>
      {onSelect && <span className="sr-only">, ubah transaksi</span>}
    </>
  );
  const cls = "flex min-h-16 w-full items-center gap-3 rounded-sm px-4 py-2";
  if (!onSelect) return <div className={cls}>{content}</div>;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(cls, "transition hover:bg-surface-variant")}
    >
      {content}
    </button>
  );
}
