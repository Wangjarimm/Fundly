import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Download, Trash2 } from "lucide-react";
import { errorMessage, exportUrl, useDeleteAccount, useMe, useUpdateMe } from "../api/hooks";
import { Sheet } from "../components/Sheet";
import { useToast } from "../components/Toast";
import { Button, Card, Chip, Field, PageTitle } from "../components/ui";
import { applyTheme, type Theme } from "../lib/theme";

const THEMES: Array<{ value: Theme; label: string }> = [
  { value: "system", label: "Ikuti sistem" },
  { value: "light", label: "Terang" },
  { value: "dark", label: "Gelap" },
];

/** Pengaturan dan privasi (F-08): profil, tema, password, ekspor, hapus akun. */
export function SettingsPage() {
  const me = useMe();
  const update = useUpdateMe();
  const toast = useToast();
  const user = me.data;
  const [name, setName] = useState(user?.display_name ?? "");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({ display_name: name.trim() });
      toast({ message: "Profil disimpan" });
    } catch (err) {
      toast({ message: errorMessage(err) });
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (newPw.length < 8) {
      setPwError("Password baru minimal 8 karakter.");
      return;
    }
    try {
      await update.mutateAsync({ new_password: newPw, ...(user?.has_password ? { current_password: currentPw } : {}) });
      setCurrentPw("");
      setNewPw("");
      toast({ message: "Password diganti. Perangkat lain sudah dikeluarkan." });
    } catch (err) {
      setPwError(errorMessage(err));
    }
  }

  function setTheme(t: Theme) {
    applyTheme(t);
    update.mutate({ theme: t }, { onError: (e) => toast({ message: errorMessage(e) }) });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageTitle>Pengaturan</PageTitle>

      <Card>
        <form onSubmit={saveName} className="flex flex-col gap-3">
          <h2 className="text-title text-ink">Profil</h2>
          <Field label="Nama panggilan" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          <p className="break-all text-body-small text-ink-muted">Email: {user?.email}</p>
          <Button type="submit" variant="secondary" className="self-start" loading={update.isPending && update.variables?.display_name !== undefined}>
            Simpan profil
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-title text-ink">Mode tampilan</h2>
        <div role="radiogroup" aria-label="Mode tampilan" className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <Chip key={t.value} role="radio" aria-checked={user?.theme === t.value} selected={user?.theme === t.value} onClick={() => setTheme(t.value)}>
              {t.label}
            </Chip>
          ))}
        </div>
      </Card>

      <Card>
        <form onSubmit={savePassword} className="flex flex-col gap-3">
          <h2 className="text-title text-ink">{user?.has_password ? "Ganti password" : "Buat password"}</h2>
          {!user?.has_password && (
            <p className="text-body-small text-ink-muted">Akunmu masuk lewat Google. Buat password agar bisa masuk dengan email juga.</p>
          )}
          {user?.has_password && (
            <Field label="Password saat ini" type="password" autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
          )}
          <Field label="Password baru" type="password" autoComplete="new-password" hint="Minimal 8 karakter." value={newPw} onChange={(e) => setNewPw(e.target.value)} error={pwError ?? undefined} />
          <Button type="submit" variant="secondary" className="self-start">
            {user?.has_password ? "Ganti password" : "Buat password"}
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-title text-ink">Data milikmu</h2>
        <p className="text-body-small text-ink-muted">Unduh semua transaksi sebagai CSV yang bisa dibuka di Excel atau Google Sheets.</p>
        <a
          href={exportUrl()}
          download
          className="inline-flex h-12 items-center gap-2 self-start rounded-md bg-primary-container px-5 text-label text-on-primary-container hover:brightness-95"
        >
          <Download aria-hidden className="size-5" /> Ekspor semua data (CSV)
        </a>
        <hr className="border-outline" />
        <p className="text-body-small text-ink-muted">Menghapus akun akan menghapus semua dompet, transaksi, dan anggaran secara permanen.</p>
        <Button variant="danger" className="self-start" onClick={() => setConfirmDelete(true)}>
          <Trash2 aria-hidden className="size-5" /> Hapus akun
        </Button>
      </Card>

      {confirmDelete && <DeleteAccountSheet onClose={() => setConfirmDelete(false)} />}
    </div>
  );
}

function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const del = useDeleteAccount();
  const [, navigate] = useLocation();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet
      open
      title="Hapus akun"
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="text-body-small text-expense">
              {error}
            </p>
          )}
          <Button
            block
            className="bg-expense text-white"
            disabled={text !== "HAPUS"}
            loading={del.isPending}
            onClick={() =>
              del.mutate(undefined, {
                onSuccess: () => navigate("/masuk", { replace: true }),
                onError: (e) => setError(errorMessage(e)),
              })
            }
          >
            Hapus akun permanen
          </Button>
          <Button variant="ghost" block onClick={onClose}>
            Batal
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 pt-2">
        <p className="text-body text-ink">Semua data akan dihapus dan tidak bisa dikembalikan. Unduh ekspor data dulu bila perlu.</p>
        <Field label='Ketik "HAPUS" untuk mengonfirmasi' value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" data-autofocus />
      </div>
    </Sheet>
  );
}
