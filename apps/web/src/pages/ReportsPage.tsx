import { lazy, Suspense, useState } from "react";
import { Download, Plus } from "lucide-react";
import { errorMessage, exportUrl, useCategories, useReport } from "../api/hooks";
import { CategoryIcon } from "../components/CategoryIcon";
import { MonthSwitcher } from "../components/MonthSwitcher";
import { Button, Card, ErrorState, PageTitle, Skeleton } from "../components/ui";
import { useOpenTransaction } from "../features/TransactionSheetContext";
import { currentMonth, monthLabel } from "../lib/date";
import { formatRupiah, formatSigned } from "../lib/money";
import { comparisonText } from "../lib/report";

// Recharts hanya dimuat di halaman ini (F-05 KP4).
const TrendChart = lazy(() => import("../features/TrendChart"));

/** Laporan bulanan (F-05). */
export function ReportsPage() {
  const [month, setMonth] = useState(currentMonth());
  const report = useReport(month);
  const categories = useCategories();
  const openTx = useOpenTransaction();
  const r = report.data;
  const catById = new Map((categories.data ?? []).map((c) => [c.id, c]));
  const empty = r && r.total_income === 0 && r.total_expense === 0;
  const maxCat = r?.by_category[0]?.amount ?? 0;
  const topDay = r?.daily.reduce((best, d) => (d.expense > best.expense ? d : best), r.daily[0]!);

  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        action={
          r && !empty ? (
            <a
              href={exportUrl(month)}
              download
              className="inline-flex h-12 items-center gap-2 rounded-md px-3 text-label text-primary hover:bg-surface-variant"
            >
              <Download aria-hidden className="size-5" /> Ekspor CSV
            </a>
          ) : undefined
        }
      >
        Laporan
      </PageTitle>
      <MonthSwitcher month={month} onChange={setMonth} />

      {report.isPending ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : report.isError ? (
        <ErrorState message={errorMessage(report.error)} onRetry={() => void report.refetch()} />
      ) : empty ? (
        <Card className="flex flex-col items-start gap-3">
          <p className="text-body text-ink">Belum ada catatan di {monthLabel(month)}. Catat pengeluaran pertamamu.</p>
          <Button variant="secondary" onClick={() => openTx()}>
            <Plus aria-hidden className="size-5" /> Catat pengeluaran
          </Button>
        </Card>
      ) : (
        r && (
          <>
            {/* Ringkasan (KP1) */}
            <section aria-label="Ringkasan bulan" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Uang masuk" value={formatSigned(r.total_income, "income")} tone="text-income" />
              <Stat label="Uang keluar" value={formatSigned(r.total_expense, "expense")} tone="text-expense" />
              <Stat label="Selisih" value={formatRupiah(r.net)} tone="text-ink" />
              <Stat label="Rata-rata keluar per hari" value={formatRupiah(r.avg_daily_expense)} tone="text-ink" />
            </section>
            <p className="text-body text-ink-muted">{comparisonText(r.previous.expense_change_percent)}</p>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
              {/* Per kategori (KP2): batang horizontal dengan label langsung, tanpa legenda warna */}
              <Card className="flex flex-col gap-4">
                <h2 className="text-title text-ink">Pengeluaran per kategori</h2>
                {r.by_category.length === 0 ? (
                  <p className="text-body-small text-ink-muted">Belum ada pengeluaran bulan ini.</p>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {r.by_category.map((c) => {
                      const cat = c.category_id ? catById.get(c.category_id) : undefined;
                      return (
                        <li key={c.category_id ?? "none"} className="flex items-center gap-3">
                          <CategoryIcon icon={cat?.icon} tone={cat?.color_token} kind="expense" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-label text-ink">{c.name}</span>
                              <span className="shrink-0 text-body-small tabular text-ink-muted">
                                {c.percent.toLocaleString("id-ID")}%
                              </span>
                            </div>
                            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-variant" aria-hidden>
                              <div className="h-full rounded-full bg-primary" style={{ width: `${maxCat ? (c.amount / maxCat) * 100 : 0}%` }} />
                            </div>
                            <span className="text-body-small tabular text-ink-muted">{formatRupiah(c.amount)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>

              {/* Tren harian (KP4), dimuat lazy, dengan ringkasan teks untuk pembaca layar */}
              <Card className="flex flex-col gap-3">
                <h2 className="text-title text-ink">Tren pengeluaran harian</h2>
                <Suspense fallback={<Skeleton className="h-56" />}>
                  <TrendChart daily={r.daily} />
                </Suspense>
                <p className="text-body-small text-ink-muted">
                  {topDay && topDay.expense > 0
                    ? `Pengeluaran terbesar pada tanggal ${Number(topDay.date.slice(8))}: ${formatRupiah(topDay.expense)}.`
                    : "Belum ada pengeluaran bulan ini."}
                </p>
              </Card>
            </div>
          </>
        )
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card className="flex min-w-0 flex-col gap-1">
      <span className="text-body-small text-ink-muted">{label}</span>
      <span className={`break-words text-title tabular ${tone}`}>{value}</span>
    </Card>
  );
}
