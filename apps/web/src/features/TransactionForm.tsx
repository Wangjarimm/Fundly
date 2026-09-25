import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import {
  errorMessage,
  suggestCategory,
  useCategories,
  useCreateTransaction,
  useDeleteTransaction,
  useRestoreTransaction,
  useUpdateTransaction,
  useWallets,
  type Kind,
  type Transaction,
} from "../api/hooks";
import { Button, Chip } from "../components/ui";
import { Keypad } from "../components/Keypad";
import { Sheet } from "../components/Sheet";
import { useToast } from "../components/Toast";
import { todayISO } from "../lib/date";
import { groupThousands, keypadPress, parseDigits } from "../lib/money";
import { LAST_WALLET_KEY, load, save } from "../lib/storage";
import { cn } from "../lib/cn";

/**
 * Form tambah/ubah transaksi (F-03). Alur tercepat: ketik jumlah → Simpan
 * (jenis pengeluaran, dompet terakhir, tanggal hari ini sudah terisi).
 */
export function TransactionForm({ open, editing, onClose }: { open: boolean; editing?: Transaction | null; onClose: () => void }) {
  return open ? <FormBody key={editing?.id ?? "new"} editing={editing ?? null} onClose={onClose} /> : null;
}

function FormBody({ editing, onClose }: { editing: Transaction | null; onClose: () => void }) {
  const wallets = useWallets();
  const categories = useCategories();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const del = useDeleteTransaction();
  const restore = useRestoreTransaction();
  const toast = useToast();

  const [kind, setKind] = useState<Kind>(editing?.kind ?? "expense");
  const [amount, setAmount] = useState<number>(editing?.amount ?? 0);
  const [walletId, setWalletId] = useState<string>(editing?.wallet_id ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(editing?.category_id ?? null);
  const [merchant, setMerchant] = useState(editing?.merchant ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [date, setDate] = useState(editing?.occurred_on ?? todayISO());
  const [suggestionFor, setSuggestionFor] = useState<{ key: string; id: string | null }>({ key: "", id: null });
  const [error, setError] = useState<string | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  // Kunci idempoten: sama selama form ini terbuka, jadi retry tidak membuat transaksi ganda.
  const clientId = useMemo(() => crypto.randomUUID(), []);
  const categoryTouched = useRef(editing !== null);

  // Dompet default: terakhir dipakai (KP3), lalu dompet pertama.
  const activeWallets = wallets.data ?? [];
  const effectiveWallet =
    walletId ||
    activeWallets.find((w) => w.id === load(LAST_WALLET_KEY))?.id ||
    activeWallets[0]?.id ||
    "";

  const kindCategories = (categories.data ?? []).filter((c) => c.kind === kind);
  const visibleCategories = showAllCategories ? kindCategories : kindCategories.slice(0, 6);
  const selectedCategory = kindCategories.find((c) => c.id === categoryId);
  if (selectedCategory && !visibleCategories.includes(selectedCategory)) visibleCategories.push(selectedCategory);

  // Saran kategori saat mengetik nama toko (F-04 KP2, KP4: tidak memaksa).
  // Saran disimpan bersama teks asalnya agar saran lama tidak dipakai untuk teks baru.
  const merchantKey = `${kind}|${merchant.trim()}`;
  useEffect(() => {
    const text = merchant.trim();
    if (text.length < 3) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      suggestCategory(text, kind, ctrl.signal)
        .then((r) => setSuggestionFor({ key: `${kind}|${text}`, id: r.category_id }))
        .catch(() => {});
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [merchant, kind]);

  const suggestion = suggestionFor.key === merchantKey && merchant.trim().length >= 3 ? suggestionFor.id : null;
  const suggested = kindCategories.find((c) => c.id === suggestion && c.id !== categoryId);

  const saving = create.isPending || update.isPending;

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    if (amount <= 0) {
      setError("Jumlah harus lebih dari 0. Ketik angka lalu simpan.");
      return;
    }
    if (!effectiveWallet) {
      setError("Belum ada dompet. Buat dompet terlebih dahulu.");
      return;
    }
    const finalCategory = categoryId ?? (!categoryTouched.current && suggestion ? suggestion : null);
    const payload = {
      kind,
      amount,
      wallet_id: effectiveWallet,
      occurred_on: date,
      category_id: finalCategory,
      merchant: merchant.trim() || null,
      note: note.trim() || null,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, body: payload });
        toast({ message: "Transaksi diperbarui" });
      } else {
        const r = await create.mutateAsync({ ...payload, client_id: clientId });
        toast({ message: r.queued ? "Transaksi disimpan di perangkat, akan dikirim saat tersambung" : "Transaksi disimpan" });
      }
      save(LAST_WALLET_KEY, effectiveWallet);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove() {
    if (!editing) return;
    try {
      await del.mutateAsync(editing.id);
      onClose();
      toast({
        message: "Transaksi dihapus",
        action: { label: "Batalkan", onClick: () => restore.mutate(editing.id) },
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // Keyboard fisik: angka dan Backspace mengisi jumlah, Enter menyimpan (DESIGN.md).
  function onAmountKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <Sheet
      open
      title={editing ? "Ubah transaksi" : "Catat transaksi"}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="text-body-small text-expense">
              {error}
            </p>
          )}
          <Button block loading={saving} onClick={() => void submit()} data-testid="save-transaction">
            Simpan transaksi
          </Button>
          {editing && (
            <Button variant="danger" block loading={del.isPending} onClick={() => void remove()}>
              <Trash2 aria-hidden className="size-5" /> Hapus transaksi
            </Button>
          )}
        </div>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5 pt-2">
        {/* Jenis */}
        <div role="radiogroup" aria-label="Jenis transaksi" className="grid grid-cols-2 gap-2 rounded-md bg-surface-variant p-1">
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k);
                setCategoryId(null);
              }}
              className={cn(
                "h-12 rounded-sm text-label transition",
                kind === k ? (k === "expense" ? "bg-surface text-expense shadow-sm" : "bg-surface text-income shadow-sm") : "text-ink-muted",
              )}
            >
              {k === "expense" ? "− Uang keluar" : "+ Uang masuk"}
            </button>
          ))}
        </div>

        {/* Jumlah */}
        <div className="flex flex-col gap-3">
          <label htmlFor="amount" className="text-label text-ink-muted">
            Jumlah
          </label>
          <div className="flex items-baseline gap-2 border-b-2 border-primary pb-2">
            <span className="text-headline text-ink-muted">Rp</span>
            <input
              id="amount"
              data-autofocus
              inputMode="numeric"
              autoComplete="off"
              value={amount === 0 ? "" : groupThousands(amount)}
              placeholder="0"
              onChange={(e) => setAmount(parseDigits(e.target.value))}
              onKeyDown={onAmountKey}
              className={cn(
                "w-full min-w-0 bg-transparent font-bold tabular text-[clamp(1.75rem,8vw,2.25rem)] leading-tight outline-none placeholder:text-ink-muted/50",
                kind === "expense" ? "text-expense" : "text-income",
              )}
            />
          </div>
          <div className="md:hidden">
            <Keypad onPress={(k) => setAmount((v) => keypadPress(v, k))} />
          </div>
        </div>

        {/* Dompet */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label text-ink-muted">Dompet</legend>
          <div className="flex flex-wrap gap-2">
            {activeWallets.map((w) => (
              <Chip key={w.id} selected={w.id === effectiveWallet} onClick={() => setWalletId(w.id)}>
                {w.name}
              </Chip>
            ))}
          </div>
        </fieldset>

        {/* Toko & saran kategori */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="merchant" className="text-label text-ink-muted">
            Nama toko atau keterangan <span className="font-normal">(opsional)</span>
          </label>
          <input
            id="merchant"
            value={merchant}
            maxLength={120}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Mis. Indomaret, gaji, bensin"
            className="h-[52px] rounded-md border border-outline bg-surface px-4 text-body focus:border-primary"
          />
          {suggested && (
            <div className="pt-1">
              <Chip
                suggested
                onClick={() => {
                  categoryTouched.current = true;
                  setCategoryId(suggested.id);
                }}
              >
                <Sparkles aria-hidden className="size-4" /> Disarankan: {suggested.name}
              </Chip>
            </div>
          )}
        </div>

        {/* Kategori */}
        <fieldset>
          <legend className="mb-2 text-label text-ink-muted">
            Kategori <span className="font-normal">(opsional)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {visibleCategories.map((c) => (
              <Chip
                key={c.id}
                selected={c.id === categoryId}
                onClick={() => {
                  categoryTouched.current = true;
                  setCategoryId(c.id === categoryId ? null : c.id);
                }}
              >
                {c.name}
              </Chip>
            ))}
            {kindCategories.length > 6 && (
              <Chip onClick={() => setShowAllCategories((v) => !v)}>
                {showAllCategories ? "Lebih sedikit" : "Semua kategori"}
              </Chip>
            )}
          </div>
        </fieldset>

        {/* Tanggal & catatan */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="date" className="text-label text-ink-muted">
              Tanggal
            </label>
            <input
              id="date"
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value || todayISO())}
              className="h-[52px] rounded-md border border-outline bg-surface px-4 text-body focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="note" className="text-label text-ink-muted">
              Catatan <span className="font-normal">(opsional)</span>
            </label>
            <input
              id="note"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              className="h-[52px] rounded-md border border-outline bg-surface px-4 text-body focus:border-primary"
            />
          </div>
        </div>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}
