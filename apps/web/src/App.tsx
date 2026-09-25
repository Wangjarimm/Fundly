import { useEffect, useState } from "react";

type Status = "checking" | "ok" | "down";

// Halaman kerangka M0: membuktikan frontend dan backend tersaji dari domain yang sama.
// Diganti dengan aplikasi sesungguhnya di M2.
export function App() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    fetch("/api/v1/healthz", { signal: ctrl.signal })
      .then((res) => setStatus(res.ok ? "ok" : "down"))
      .catch(() => setStatus("down"))
      .finally(() => clearTimeout(timer));
    return () => ctrl.abort();
  }, []);

  const label = {
    checking: "Menyambungkan…",
    ok: "Server dan database tersambung.",
    down: "Server belum bisa dihubungi. Coba lagi sebentar lagi.",
  }[status];

  return (
    <main
      style={{
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: "#1B2130",
        background: "#F5F6FA",
        minHeight: "100dvh",
        margin: 0,
        padding: "32px 16px",
      }}
    >
      <h1 style={{ color: "#2F3E9E", margin: 0 }}>Fundly</h1>
      <p>Kelola dana, sederhana.</p>
      <p role="status" aria-live="polite">
        {label}
      </p>
    </main>
  );
}
