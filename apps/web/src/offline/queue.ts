// Antrean transaksi baru saat offline atau backend belum siap (F-07 KP4, D-16d).
// Disimpan di IndexedDB; dikirim ulang saat online dengan client_id yang sama,
// sehingga backend tidak membuat transaksi ganda (idempoten).

import { createStore, del, entries, set } from "idb-keyval";
import { ApiError, NetworkError, type Schemas } from "../api/client";

export type TransactionCreate = Schemas["TransactionCreate"] & { client_id: string };

export interface QueuedTransaction {
  clientId: string;
  userId: string;
  body: TransactionCreate;
  queuedAt: number;
}

export interface FlushResult {
  sent: number;
  failed: Array<{ item: QueuedTransaction; message: string }>;
  stoppedByNetwork: boolean;
}

const store = createStore("fundly", "tx-queue");

let items: QueuedTransaction[] = [];
let syncing = false;
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  items = [...items];
  listeners.forEach((l) => l());
}

export const queue = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  snapshot: () => items,
  isSyncing: () => syncing,
};

/** Muat antrean dari IndexedDB (sekali per sesi halaman). */
export function loadQueue(): Promise<void> {
  loaded ??= entries<string, QueuedTransaction>(store)
    .then((rows) => {
      items = rows.map(([, v]) => v).sort((a, b) => a.queuedAt - b.queuedAt);
      emit();
    })
    .catch(() => {
      // IndexedDB tidak tersedia (mode privat tertentu): antrean hanya di memori.
    });
  return loaded;
}

export async function enqueue(userId: string, body: TransactionCreate): Promise<QueuedTransaction> {
  await loadQueue();
  const item: QueuedTransaction = { clientId: body.client_id, userId, body, queuedAt: Date.now() };
  items = items.filter((i) => i.clientId !== item.clientId).concat(item);
  emit();
  await set(item.clientId, item, store).catch(() => {});
  return item;
}

async function remove(clientId: string) {
  items = items.filter((i) => i.clientId !== clientId);
  emit();
  await del(clientId, store).catch(() => {});
}

/** Hapus seluruh antrean milik satu pengguna (mis. saat hapus akun). */
export async function clearQueue(userId: string) {
  for (const i of items.filter((x) => x.userId === userId)) await remove(i.clientId);
}

/**
 * Kirim antrean milik userId secara berurutan. Berhenti di kegagalan jaringan
 * (dicoba lagi nanti). Kesalahan validasi (4xx) tidak akan berhasil bila diulang,
 * jadi dikeluarkan dari antrean dan dilaporkan.
 */
export async function flushQueue(userId: string, send: (body: TransactionCreate) => Promise<unknown>): Promise<FlushResult> {
  await loadQueue();
  const result: FlushResult = { sent: 0, failed: [], stoppedByNetwork: false };
  if (syncing) return result;
  const mine = items.filter((i) => i.userId === userId);
  if (mine.length === 0) return result;
  syncing = true;
  emit();
  try {
    for (const item of mine) {
      try {
        await send(item.body);
        await remove(item.clientId);
        result.sent++;
      } catch (err) {
        if (err instanceof NetworkError || !(err instanceof ApiError) || err.status >= 500 || err.status === 429) {
          result.stoppedByNetwork = true;
          break;
        }
        await remove(item.clientId);
        result.failed.push({ item, message: err.message });
      }
    }
  } finally {
    syncing = false;
    emit();
  }
  return result;
}

/** Hanya untuk tes: kosongkan status di memori. */
export function __resetForTests() {
  items = [];
  syncing = false;
  loaded = null;
}
