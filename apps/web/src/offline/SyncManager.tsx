import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { sendQueued, useMe, type Transaction } from "../api/hooks";
import { useToast } from "../components/Toast";
import { formatRupiah } from "../lib/money";
import { flushQueue, loadQueue, queue } from "./queue";

const RETRY_MS = 30_000;

/**
 * Mengirim antrean transaksi saat aplikasi dibuka, saat kembali online, dan
 * berkala selama masih ada antrean (F-07 KP4). Tidak merender apa pun.
 */
export function SyncManager() {
  const me = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const userId = me.data?.id;
  const pending = usePendingTransactions().length;

  useEffect(() => {
    if (!userId) return;
    let stopped = false;
    const run = async () => {
      if (stopped || !navigator.onLine) return;
      const r = await flushQueue(userId, sendQueued);
      if (r.sent > 0) {
        void qc.invalidateQueries();
        toast({ message: r.sent === 1 ? "1 transaksi tersinkron" : `${r.sent} transaksi tersinkron` });
      }
      for (const f of r.failed) toast({ message: `Transaksi ${formatRupiah(f.item.body.amount)} tidak bisa dikirim: ${f.message}` });
    };
    void loadQueue().then(run);
    window.addEventListener("online", run);
    const timer = pending > 0 ? setInterval(run, RETRY_MS) : undefined;
    return () => {
      stopped = true;
      window.removeEventListener("online", run);
      clearInterval(timer);
    };
  }, [userId, pending, qc, toast]);

  return null;
}

/** Transaksi di antrean milik pengguna saat ini, dalam bentuk Transaction untuk ditampilkan. */
export function usePendingTransactions(month?: string): Transaction[] {
  const me = useMe();
  const items = useSyncExternalStore(queue.subscribe, queue.snapshot, queue.snapshot);
  const userId = me.data?.id;
  return useMemo(
    () =>
      items
        .filter((i) => i.userId === userId && (!month || i.body.occurred_on.startsWith(month)))
        .map((i) => ({
          id: `pending-${i.clientId}`,
          wallet_id: i.body.wallet_id,
          category_id: i.body.category_id ?? null,
          kind: i.body.kind,
          amount: i.body.amount,
          occurred_on: i.body.occurred_on,
          merchant: i.body.merchant ?? null,
          note: i.body.note ?? null,
          source: "manual" as const,
          client_id: i.clientId,
          created_at: new Date(i.queuedAt).toISOString(),
          updated_at: new Date(i.queuedAt).toISOString(),
        }))
        .reverse(),
    [items, userId, month],
  );
}

export const isPending = (t: Pick<Transaction, "id">) => t.id.startsWith("pending-");
