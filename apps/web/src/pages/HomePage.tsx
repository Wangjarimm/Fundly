import { Link } from "wouter";
import { Plus } from "lucide-react";
import { errorMessage, useCategories, useMe, useWallets } from "../api/hooks";
import { HeroCard } from "../components/HeroCard";
import { TransactionGroups } from "../components/TransactionGroups";
import { Button, Card, ErrorState, Skeleton } from "../components/ui";
import { useOpenTransaction } from "../features/TransactionSheetContext";
import { useMonthTransactions } from "../features/useMonthTransactions";
import { currentMonth, greeting, longDate, todayISO } from "../lib/date";
import { formatRupiah } from "../lib/money";

/** Beranda: sapaan → kartu hero → dompet → transaksi terbaru (DESIGN.md: Layout). */
export function HomePage() {
  const me = useMe();
  const wallets = useWallets();
  const categories = useCategories();
  const month = useMonthTransactions(currentMonth());
  const openTx = useOpenTransaction();

  const balance = (wallets.data ?? []).reduce((s, w) => s + w.balance, 0);
  const recent = month.items.slice(0, 6);
  const name = me.data?.display_name?.trim();

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
            <HeroCard balance={balance} income={month.totals.income} expense={month.totals.expense} loading={wallets.isPending || month.isPending} />
          )}

          <section aria-labelledby="dompet-heading" className="flex flex-col gap-2">
            <h2 id="dompet-heading" className="text-title text-ink">
              Dompet
            </h2>
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
          {month.isPending ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : month.isError ? (
            <ErrorState message={errorMessage(month.error)} onRetry={() => void month.refetch()} />
          ) : recent.length === 0 ? (
            <Card className="flex flex-col items-start gap-3">
              <p className="text-body text-ink">Belum ada catatan bulan ini. Catat pengeluaran pertamamu.</p>
              <Button variant="secondary" onClick={() => openTx()}>
                <Plus aria-hidden className="size-5" /> Catat pengeluaran
              </Button>
            </Card>
          ) : (
            <TransactionGroups items={recent} wallets={wallets.data ?? []} categories={categories.data ?? []} onSelect={openTx} />
          )}
        </section>
      </div>
    </div>
  );
}
