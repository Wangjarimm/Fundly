import { Link, useLocation } from "wouter";
import { ChevronRight, LogOut, PiggyBank, Settings, Shapes, ShieldCheck, Wallet, type LucideIcon } from "lucide-react";
import { useLogout, useMe } from "../api/hooks";
import { Button, Card, PageTitle } from "../components/ui";

const LINKS: Array<{ href: string; label: string; desc: string; icon: LucideIcon }> = [
  { href: "/anggaran", label: "Anggaran", desc: "Batas pengeluaran per kategori", icon: PiggyBank },
  { href: "/dompet", label: "Dompet", desc: "Tunai, bank, dan e-wallet", icon: Wallet },
  { href: "/kategori", label: "Kategori", desc: "Tambah, ubah, atau sembunyikan", icon: Shapes },
  { href: "/pengaturan", label: "Pengaturan", desc: "Profil, tema, password, ekspor data", icon: Settings },
  { href: "/privasi", label: "Kebijakan privasi", desc: "Data apa yang disimpan", icon: ShieldCheck },
];

/** Hub "Lainnya" di navigasi bawah. */
export function MorePage() {
  const me = useMe();
  const logout = useLogout();
  const [, navigate] = useLocation();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageTitle>Lainnya</PageTitle>
      <Card>
        <p className="text-title text-ink">{me.data?.display_name || "Akun"}</p>
        <p className="break-all text-body-small text-ink-muted">{me.data?.email}</p>
      </Card>
      <nav aria-label="Menu lainnya">
        <ul className="divide-y divide-outline overflow-hidden rounded-md border border-outline bg-surface">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-surface-variant">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary-container text-on-primary-container">
                  <l.icon className="size-5" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-title text-ink">{l.label}</span>
                  <span className="block text-body-small text-ink-muted">{l.desc}</span>
                </span>
                <ChevronRight aria-hidden className="size-5 text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <Card className="flex flex-col gap-3">
        <h2 className="text-title text-ink">Tentang Fundly</h2>
        <img src="/brand/logo-horizontal.svg" alt="Fundly" height={40} className="h-10 w-auto self-start dark:hidden" />
        <img src="/brand/logo-mono-light.svg" alt="Fundly" height={40} className="hidden h-10 w-auto self-start dark:block" />
        <p className="text-body-small text-ink-muted">
          Nama Fundly berasal dari “fund” (dana) dan “-ly” (dengan cara): mengelola dana dengan cara yang sederhana.
        </p>
      </Card>
      <Button
        variant="danger"
        className="self-start"
        loading={logout.isPending}
        onClick={() => logout.mutate(undefined, { onSettled: () => navigate("/masuk", { replace: true }) })}
      >
        <LogOut aria-hidden className="size-5" /> Keluar
      </Button>
    </div>
  );
}
