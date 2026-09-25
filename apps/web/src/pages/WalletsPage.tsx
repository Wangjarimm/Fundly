import { useState } from "react";
import { Archive, Banknote, Building2, Plus, Smartphone, Wallet as WalletIcon, type LucideIcon } from "lucide-react";
import { errorMessage, useAllWallets, useSaveWallet, type Wallet } from "../api/hooks";
import { AmountField } from "../components/AmountField";
import { Sheet } from "../components/Sheet";
import { useToast } from "../components/Toast";
import { Button, Chip, ErrorState, Field, PageTitle, Skeleton } from "../components/ui";
import { formatRupiah } from "../lib/money";

type WalletType = Wallet["type"];

const TYPES: Array<{ value: WalletType; label: string; icon: LucideIcon }> = [
  { value: "cash", label: "Tunai", icon: Banknote },
  { value: "bank", label: "Bank", icon: Building2 },
  { value: "ewallet", label: "E-wallet", icon: Smartphone },
  { value: "other", label: "Lainnya", icon: WalletIcon },
];

// Label penyedia preset (F-02 KP2); tetap boleh diketik bebas.
const PROVIDERS = ["GoPay", "OVO", "DANA", "ShopeePay", "LinkAja"];

/** Daftar dan ubah dompet (F-02). */
export function WalletsPage() {
  const wallets = useAllWallets();
  const [editing, setEditing] = useState<Wallet | "new" | null>(null);
  const active = (wallets.data ?? []).filter((w) => !w.archived_at);
  const archived = (wallets.data ?? []).filter((w) => w.archived_at);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageTitle
        action={
          <Button variant="secondary" onClick={() => setEditing("new")}>
            <Plus aria-hidden className="size-5" /> Dompet baru
          </Button>
        }
      >
        Dompet
      </PageTitle>
      {wallets.isPending ? (
        <Skeleton className="h-40" />
      ) : wallets.isError ? (
        <ErrorState message={errorMessage(wallets.error)} onRetry={() => void wallets.refetch()} />
      ) : (
        <>
          <WalletList items={active} onSelect={setEditing} />
          {archived.length > 0 && (
            <section aria-labelledby="diarsipkan" className="flex flex-col gap-2">
              <h2 id="diarsipkan" className="flex items-center gap-2 text-title text-ink-muted">
                <Archive aria-hidden className="size-5" /> Diarsipkan
              </h2>
              <WalletList items={archived} onSelect={setEditing} />
            </section>
          )}
        </>
      )}
      {editing && <WalletSheet key={editing === "new" ? "new" : editing.id} wallet={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function WalletList({ items, onSelect }: { items: Wallet[]; onSelect: (w: Wallet) => void }) {
  return (
    <ul className="divide-y divide-outline overflow-hidden rounded-md border border-outline bg-surface">
      {items.map((w) => {
        const t = TYPES.find((x) => x.value === w.type) ?? TYPES[3]!;
        return (
          <li key={w.id}>
            <button
              type="button"
              onClick={() => onSelect(w)}
              className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface-variant"
              aria-label={`${w.name}, saldo ${formatRupiah(w.balance)}. Ubah dompet`}
            >
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary-container text-on-primary-container">
                <t.icon className="size-5" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-title text-ink">{w.name}</span>
                <span className="block truncate text-body-small text-ink-muted">{[t.label, w.provider].filter(Boolean).join(" · ")}</span>
              </span>
              <span className={`shrink-0 text-title tabular ${w.balance < 0 ? "text-expense" : "text-ink"}`}>{formatRupiah(w.balance)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function WalletSheet({ wallet, onClose }: { wallet: Wallet | null; onClose: () => void }) {
  const save = useSaveWallet();
  const toast = useToast();
  const [name, setName] = useState(wallet?.name ?? "");
  const [type, setType] = useState<WalletType>(wallet?.type ?? "cash");
  const [provider, setProvider] = useState(wallet?.provider ?? "");
  const [initial, setInitial] = useState(wallet?.initial_balance ?? 0);
  const [error, setError] = useState<string | null>(null);

  async function submit(archived?: boolean) {
    setError(null);
    if (!name.trim()) {
      setError("Nama dompet belum diisi.");
      return;
    }
    try {
      await save.mutateAsync({
        id: wallet?.id,
        body: {
          name: name.trim(),
          type,
          provider: type === "ewallet" || type === "bank" ? provider.trim() || null : null,
          initial_balance: initial,
          ...(archived !== undefined ? { archived } : {}),
        },
      });
      toast({ message: archived === true ? "Dompet diarsipkan" : archived === false ? "Dompet dipulihkan" : "Dompet disimpan" });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Sheet
      open
      title={wallet ? "Ubah dompet" : "Dompet baru"}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="text-body-small text-expense">
              {error}
            </p>
          )}
          <Button block loading={save.isPending} onClick={() => void submit()}>
            Simpan dompet
          </Button>
          {wallet && (
            <Button variant="ghost" block onClick={() => void submit(!wallet.archived_at)}>
              {wallet.archived_at ? "Pulihkan dompet" : "Arsipkan dompet"}
            </Button>
          )}
        </div>
      }
    >
      <form
        className="flex flex-col gap-4 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Nama dompet" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} data-autofocus />
        <fieldset>
          <legend className="mb-2 text-label text-ink">Jenis</legend>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <Chip key={t.value} selected={type === t.value} onClick={() => setType(t.value)}>
                <t.icon aria-hidden className="size-4" /> {t.label}
              </Chip>
            ))}
          </div>
        </fieldset>
        {(type === "ewallet" || type === "bank") && (
          <div className="flex flex-col gap-2">
            <Field
              label={type === "ewallet" ? "Penyedia (opsional)" : "Nama bank (opsional)"}
              value={provider}
              maxLength={40}
              onChange={(e) => setProvider(e.target.value)}
            />
            {type === "ewallet" && (
              <div className="flex flex-wrap gap-2">
                {PROVIDERS.map((p) => (
                  <Chip key={p} selected={provider === p} onClick={() => setProvider(p)}>
                    {p}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        )}
        <AmountField label="Saldo awal" value={initial} onChange={setInitial} allowNegative />
        <p className="text-body-small text-ink-muted">Saldo sekarang = saldo awal + uang masuk − uang keluar.</p>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}
