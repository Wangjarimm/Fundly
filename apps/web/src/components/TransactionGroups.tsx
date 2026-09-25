import { useMemo } from "react";
import type { Category, Transaction, Wallet } from "../api/hooks";
import { dayHeading } from "../lib/date";
import { TransactionRow } from "./TransactionRow";
import { isPending } from "../offline/SyncManager";

/** Daftar transaksi dikelompokkan per hari dengan judul tanggal (DESIGN.md). */
export function TransactionGroups({
  items,
  wallets,
  categories,
  onSelect,
}: {
  items: Transaction[];
  wallets: Wallet[];
  categories: Category[];
  onSelect?: (tx: Transaction) => void;
}) {
  const walletById = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const groups = useMemo(() => {
    const out: Array<{ day: string; items: Transaction[] }> = [];
    // Urut menurun per tanggal; transaksi antrean (pending) ikut disisipkan.
    const sorted = [...items].sort((a, b) => (a.occurred_on === b.occurred_on ? 0 : a.occurred_on < b.occurred_on ? 1 : -1));
    for (const t of sorted) {
      const last = out[out.length - 1];
      if (last && last.day === t.occurred_on) last.items.push(t);
      else out.push({ day: t.occurred_on, items: [t] });
    }
    return out;
  }, [items]);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <section key={g.day} aria-label={dayHeading(g.day)}>
          <h3 className="mb-1 px-1 text-label text-ink-muted">{dayHeading(g.day)}</h3>
          <ul className="divide-y divide-outline overflow-hidden rounded-md border border-outline bg-surface">
            {g.items.map((t) => (
              <li key={t.id}>
                <TransactionRow
                  tx={t}
                  wallet={walletById.get(t.wallet_id)}
                  category={t.category_id ? categoryById.get(t.category_id) : undefined}
                  pending={isPending(t)}
                  onSelect={onSelect && !isPending(t) ? () => onSelect(t) : undefined}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
