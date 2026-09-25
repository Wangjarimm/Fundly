import { useDeferredValue, useState } from "react";
import { Plus, Search } from "lucide-react";
import { errorMessage, useCategories, useTransactions, useWallets, type Kind } from "../api/hooks";
import { TransactionGroups } from "../components/TransactionGroups";
import { Button, Card, Chip, ErrorState, PageTitle, Skeleton } from "../components/ui";
import { useOpenTransaction } from "../features/TransactionSheetContext";
import { usePendingTransactions } from "../offline/SyncManager";
import { currentMonth, monthLabel } from "../lib/date";
import { MonthSwitcher } from "../components/MonthSwitcher";

/** Daftar transaksi per bulan dengan pencarian dan filter (F-03 KP4). */
export function TransactionsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [kind, setKind] = useState<Kind | undefined>();
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim());
  const wallets = useWallets();
  const categories = useCategories();
  const openTx = useOpenTransaction();
  const list = useTransactions({ month, kind, wallet_id: walletId || undefined, category_id: categoryId || undefined, q: q || undefined });
  const filtered = Boolean(kind || walletId || categoryId || q);
  const pending = usePendingTransactions(month);
  const items = [...(filtered ? [] : pending), ...(list.data?.pages.flatMap((p) => p.items) ?? [])];

  const selectCls = "h-12 min-w-0 rounded-md border border-outline bg-surface px-3 text-body-small text-ink";

  return (
    <div>
      <PageTitle>Transaksi</PageTitle>

      <div className="mb-4">
        <MonthSwitcher month={month} onChange={setMonth} />
      </div>

      {/* Pencarian & filter */}
      <div className="mb-5 flex flex-col gap-3">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
          <label htmlFor="search" className="sr-only">
            Cari transaksi
          </label>
          <input
            id="search"
            type="search"
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama toko atau catatan"
            className="h-12 w-full rounded-md border border-outline bg-surface pl-12 pr-4 text-body focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip selected={!kind} onClick={() => setKind(undefined)}>
            Semua
          </Chip>
          <Chip selected={kind === "expense"} onClick={() => setKind("expense")}>
            − Keluar
          </Chip>
          <Chip selected={kind === "income"} onClick={() => setKind("income")}>
            + Masuk
          </Chip>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          <label className="sr-only" htmlFor="filter-wallet">
            Filter dompet
          </label>
          <select id="filter-wallet" value={walletId} onChange={(e) => setWalletId(e.target.value)} className={selectCls}>
            <option value="">Semua dompet</option>
            {(wallets.data ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="filter-category">
            Filter kategori
          </label>
          <select id="filter-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectCls}>
            <option value="">Semua kategori</option>
            {(categories.data ?? [])
              .filter((c) => !kind || c.kind === kind)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.kind === "income" ? "+ " : "− "}
                  {c.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {list.isPending && items.length === 0 ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-start gap-3">
          <p className="text-body text-ink">
            {filtered ? "Tidak ada transaksi yang cocok dengan filter ini." : `Belum ada catatan di ${monthLabel(month)}.`}
          </p>
          {!filtered && (
            <Button variant="secondary" onClick={() => openTx()}>
              <Plus aria-hidden className="size-5" /> Catat transaksi
            </Button>
          )}
        </Card>
      ) : (
        <>
          <TransactionGroups items={items} wallets={wallets.data ?? []} categories={categories.data ?? []} onSelect={openTx} headingLevel={2} />
          {list.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                Muat lebih banyak
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
