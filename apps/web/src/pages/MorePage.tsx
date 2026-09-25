import { useLocation } from "wouter";
import { LogOut } from "lucide-react";
import { errorMessage, useLogout, useMe, useUpdateMe } from "../api/hooks";
import { Button, Card, Chip, PageTitle } from "../components/ui";
import { useToast } from "../components/Toast";
import { applyTheme, type Theme } from "../lib/theme";

const THEMES: Array<{ value: Theme; label: string }> = [
  { value: "system", label: "Ikuti sistem" },
  { value: "light", label: "Terang" },
  { value: "dark", label: "Gelap" },
];

/** Lainnya: profil, mode tampilan, dan keluar. Dompet/kategori/pengaturan lengkap menyusul. */
export function MorePage() {
  const me = useMe();
  const update = useUpdateMe();
  const logout = useLogout();
  const toast = useToast();
  const [, navigate] = useLocation();
  const theme = (me.data?.theme ?? "system") as Theme;

  function setTheme(t: Theme) {
    applyTheme(t);
    update.mutate(
      { theme: t },
      { onError: (e) => toast({ message: errorMessage(e) }) },
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageTitle>Lainnya</PageTitle>
      <Card>
        <p className="text-title text-ink">{me.data?.display_name || "Akun"}</p>
        <p className="break-all text-body-small text-ink-muted">{me.data?.email}</p>
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="text-title text-ink">Mode tampilan</h2>
        <div role="radiogroup" aria-label="Mode tampilan" className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <Chip key={t.value} role="radio" aria-checked={theme === t.value} selected={theme === t.value} onClick={() => setTheme(t.value)}>
              {t.label}
            </Chip>
          ))}
        </div>
      </Card>
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
