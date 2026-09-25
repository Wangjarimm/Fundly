import { useEffect, useMemo } from "react";
import { useTransactions, type Transaction } from "../api/hooks";

/**
 * Semua transaksi satu bulan beserta total masuk/keluar.
 * Sementara dihitung di klien dari halaman transaksi; di M3 diganti
 * endpoint /reports/monthly yang menghitung agregat di SQL.
 */
export function useMonthTransactions(month: string) {
  const q = useTransactions({ month, limit: 100 });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  const pages = q.data?.pages.length ?? 0;

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && pages < 10) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, pages]);

  const items: Transaction[] = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of items) {
      if (t.kind === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense };
  }, [items]);

  return { ...q, items, totals };
}
