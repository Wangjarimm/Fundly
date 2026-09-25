import { Link } from "wouter";
import { Plus } from "lucide-react";
import { errorMessage, useBudgets, useCategories, useMe, useReport, useTransactions, useWallets } from "../api/hooks";
import { BudgetProgress } from "../components/BudgetProgress";
import { HeroCard } from "../components/HeroCard";
import { TransactionGroups } from "../components/TransactionGroups";
import { Button, Card, ErrorState, Skeleton } from "../components/ui";
import { useOpenTransaction } from "../features/TransactionSheetContext";
import { usePendingTransactions } from "../offline/SyncManager";
import { currentMonth, greeting, longDate, todayISO } from "../lib/date";
import { formatRupiah } from "../lib/money";

/**
 * Beranda (DESIGN.md: Layout): sapaan → kartu hero → anggaran yang perlu
 * perhatian → transaksi terbaru → dompet.
 */
export function HomePage() {
  const month = currentMonth();
  const me = useMe();
  const wallets = useWallets();
  const categories = useCategories();
  const report = useReport(month);
  const budgets = useBudgets(month);
  const recent = useTransactions({ month, limit: 6 });
  const openTx = useOpenTransaction();

  const balance = (wallets.data ?? []).reduce((s, w) => s + w.balance, 0);
  const pending = usePendingTransactions(month);
  const recentItems = [...pending, ...(recent.data?.pages[0]?.items ?? [])].slice(0, 6);
  const name = me.data?.display_name?.trim();
  const catById = new Map((categories.data ?? []).map((c) => [c.id, c]));
  const attention = (budgets.data ?? []).filter((b) => b.status !== "safe");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-headline text-ink">
          {greeting()}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="text-body-small text-ink-muted">{longDate(todayISO())}</p>
      </div>

      {/* grid-cols-1 = minmax(0,1fr): tanpa ini track implisit melebar mengikuti teks panjang yang di-truncate. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        {/* Kolom kiri: ringkasan */}
        <div className="flex flex-col gap-6">
          {wallets.isError ? (
            <ErrorState message={errorMessage(wallets.error)} onRetry={() => void wallets.refetch()} />
          ) : (
            <HeroCard
              balance={balance}
              income={report.data?.total_income ?? 0}
              expense={report.data?.total_expense ?? 0}
              loading={wallets.isPending || report.isPending}
            />
          )}

          {attention.length > 0 && (
            <section aria-labelledby="anggaran-heading" className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 id="anggaran-heading" className="text-title text-ink">
                  Anggaran yang perlu dilihat
                </h2>
                <Link href="/anggaran" className="inline-flex min-h-12 items-center px-1 text-label text-primary hover:underline">
                  Semua anggaran
                </Link>
              </div>
              {attention.map((b) => (
                <Card key={b.category_id} className="flex flex-col gap-2">
                  <span className="text-label text-ink">{catById.get(b.category_id)?.name ?? "Kategori"}</span>
                  <BudgetProgress budget={b} />
                </Card>
              ))}
            </section>
          )}

          <section aria-labelledby="dompet-heading" className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 id="dompet-heading" className="text-title text-ink">
                Dompet
              </h2>
              <Link href="/dompet" className="inline-flex min-h-12 items-center px-1 text-label text-primary hover:underline">
                Kelola
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
              {wallets.isPending
                ? [0, 1].map((i) => <Skeleton key={i} className="h-[72px]" />)
                : (wallets.data ?? []).map((w) => (
                    <Card key={w.id} className="flex min-w-0 flex-col gap-0.5 p-3.5">
                      <span className="truncate text-label text-ink">{w.name}</span>
                      <span className="truncate text-body-small tabular text-ink-muted">{formatRupiah(w.balance)}</span>
                    </Card>
                  ))}
            </div>
          </section>
        </div>

        {/* Kolom kanan: transaksi terbaru */}
        <section aria-labelledby="terbaru-heading" className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 id="terbaru-heading" className="text-title text-ink">
              Transaksi terbaru
            </h2>
            <Link href="/transaksi" className="inline-flex min-h-12 items-center px-1 text-label text-primary hover:underline">
              Lihat semua
            </Link>
          </div>
          {recent.isPending && pending.length === 0 ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : recent.isError ? (
            <ErrorState message={errorMessage(recent.error)} onRetry={() => void recent.refetch()} />
          ) : recentItems.length === 0 ? (
            <Card className="flex flex-col items-start gap-3">
              <p className="text-body text-ink">Belum ada catatan bulan ini. Catat pengeluaran pertamamu.</p>
              <Button variant="secondary" onClick={() => openTx()}>
                <Plus aria-hidden className="size-5" /> Catat pengeluaran
              </Button>
            </Card>
          ) : (
            <TransactionGroups items={recentItems} wallets={wallets.data ?? []} categories={categories.data ?? []} onSelect={openTx} />
          )}
        </section>
      </div>
    </div>
  );
}
