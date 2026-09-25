import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type Schemas } from "./client";

export type User = Schemas["User"];
export type Wallet = Schemas["Wallet"];
export type Category = Schemas["Category"];
export type Transaction = Schemas["Transaction"];
export type TransactionCreate = Schemas["TransactionCreate"];
export type TransactionUpdate = Schemas["TransactionUpdate"];
export type Kind = Schemas["Kind"];

export const keys = {
  me: ["me"] as const,
  wallets: ["wallets"] as const,
  categories: ["categories"] as const,
  transactions: (filters: TransactionFilters) => ["transactions", filters] as const,
  allTransactions: ["transactions"] as const,
};

// --- Profil dan auth ---

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return await api<User>("GET", "/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) => api<User>("POST", "/auth/login", { body }),
    onSuccess: (user) => {
      qc.clear();
      qc.setQueryData(keys.me, user);
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string; display_name?: string }) =>
      api<User>("POST", "/auth/register", { body }),
    onSuccess: (user) => {
      qc.clear();
      qc.setQueryData(keys.me, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("POST", "/auth/logout"),
    onSettled: () => {
      qc.clear();
      qc.setQueryData(keys.me, null);
    },
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["UpdateMeRequest"]) => api<User>("PATCH", "/me", { body }),
    onSuccess: (user) => qc.setQueryData(keys.me, user),
  });
}

// --- Dompet dan kategori ---

export function useWallets() {
  return useQuery({
    queryKey: keys.wallets,
    queryFn: async () => (await api<{ items: Wallet[] }>("GET", "/wallets")).items,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: async () => (await api<{ items: Category[] }>("GET", "/categories")).items,
    staleTime: 10 * 60_000,
  });
}

export async function suggestCategory(merchant: string, kind: Kind, signal?: AbortSignal) {
  return api<{ category_id: string | null; confidence: number }>("POST", "/categories/suggest", {
    body: { merchant, kind },
    signal,
  });
}

// --- Transaksi ---

export interface TransactionFilters {
  month: string;
  wallet_id?: string;
  category_id?: string;
  kind?: Kind;
  q?: string;
  limit?: number;
}

function toQuery(f: TransactionFilters, cursor?: string | null): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "") p.set(k, String(v));
  if (cursor) p.set("cursor", cursor);
  return p.toString();
}

type Page = { items: Transaction[]; next_cursor: string | null };

export function useTransactions(filters: TransactionFilters) {
  return useInfiniteQuery({
    queryKey: keys.transactions(filters),
    queryFn: ({ pageParam, signal }) => api<Page>("GET", `/transactions?${toQuery(filters, pageParam)}`, { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  });
}

function invalidateMoney(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: keys.allTransactions });
  void qc.invalidateQueries({ queryKey: keys.wallets });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    // Aman diulang karena idempoten lewat client_id (F-07 KP4).
    mutationFn: (body: TransactionCreate) => api<Transaction>("POST", "/transactions", { body, retry: true }),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TransactionUpdate }) =>
      api<Transaction>("PATCH", `/transactions/${id}`, { body }),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>("DELETE", `/transactions/${id}`),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useRestoreTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<Transaction>("POST", `/transactions/${id}/restore`),
    onSuccess: () => invalidateMoney(qc),
  });
}

/** Pesan error yang aman ditampilkan. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return "Terjadi kesalahan. Coba lagi sebentar lagi.";
}
