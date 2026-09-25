import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { api, ApiError } from "../api/client";
import { Brand } from "../components/Brand";
import { Button, Card } from "../components/ui";

type Health = { status: string; db: string };

/**
 * Halaman status sederhana (PRD M5): apakah server dan database bisa dihubungi.
 * Bisa dibuka tanpa masuk, misalnya saat proyek Supabase sedang dijeda.
 */
export function StatusPage() {
  const health = useQuery({
    queryKey: ["healthz"],
    queryFn: ({ signal }) => api<Health>("GET", "/healthz", { signal }),
    retry: false,
    gcTime: 0,
  });

  const dbDown = health.error instanceof ApiError && health.error.code === "db_unavailable";
  const serverDown = health.isError && !dbDown;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-4 py-8">
      <Link href="/" className="self-start">
        <Brand />
      </Link>
      <h1 className="text-headline text-ink">Status layanan</h1>
      <Card className="flex flex-col gap-4">
        <Row label="Aplikasi" state="ok" text="Tersedia" />
        <Row
          label="Server"
          state={health.isPending ? "loading" : serverDown ? "down" : "ok"}
          text={health.isPending ? "Memeriksa…" : serverDown ? "Belum bisa dihubungi" : "Tersambung"}
        />
        <Row
          label="Database"
          state={health.isPending ? "loading" : health.isSuccess ? "ok" : "down"}
          text={health.isPending ? "Memeriksa…" : health.isSuccess ? "Tersambung" : "Belum bisa dihubungi"}
        />
      </Card>
      {health.isError && (
        <p className="text-body text-ink-muted">
          {dbDown
            ? "Database sedang tidak bisa dihubungi, biasanya karena sedang dipulihkan. Transaksi yang kamu catat tetap tersimpan di perangkat dan dikirim otomatis nanti."
            : "Server belum bisa dihubungi. Periksa koneksi internet, lalu coba lagi."}
        </p>
      )}
      <Button variant="secondary" className="self-start" loading={health.isFetching} onClick={() => void health.refetch()}>
        Coba lagi
      </Button>
    </main>
  );
}

function Row({ label, state, text }: { label: string; state: "ok" | "down" | "loading"; text: string }) {
  const Icon = state === "ok" ? CircleCheck : state === "down" ? CircleAlert : LoaderCircle;
  const tone = state === "ok" ? "text-income" : state === "down" ? "text-expense" : "text-ink-muted";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-label text-ink">{label}</span>
      <span className={`inline-flex items-center gap-1.5 text-label ${tone}`}>
        <Icon aria-hidden className={`size-5 ${state === "loading" ? "animate-spin" : ""}`} /> {text}
      </span>
    </div>
  );
}
