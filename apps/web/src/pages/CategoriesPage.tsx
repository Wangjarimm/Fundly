import { useState } from "react";
import { Eye, EyeOff, Plus } from "lucide-react";
import { errorMessage, useAllCategories, useSaveCategory, type Category, type Kind } from "../api/hooks";
import { CategoryIcon } from "../components/CategoryIcon";
import { Sheet } from "../components/Sheet";
import { useToast } from "../components/Toast";
import { Button, Chip, ErrorState, Field, PageTitle, Skeleton } from "../components/ui";

/** Daftar dan ubah kategori (F-04 KP1). Kategori bawaan hanya bisa disembunyikan. */
export function CategoriesPage() {
  const cats = useAllCategories();
  const save = useSaveCategory();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("expense");
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const list = (cats.data ?? []).filter((c) => c.kind === kind);

  function toggleHidden(c: Category) {
    save.mutate(
      { id: c.id, body: { hidden: !c.hidden } },
      {
        onSuccess: () => toast({ message: c.hidden ? `${c.name} ditampilkan` : `${c.name} disembunyikan` }),
        onError: (e) => toast({ message: errorMessage(e) }),
      },
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageTitle
        action={
          <Button variant="secondary" onClick={() => setEditing("new")}>
            <Plus aria-hidden className="size-5" /> Kategori baru
          </Button>
        }
      >
        Kategori
      </PageTitle>
      <div role="radiogroup" aria-label="Jenis kategori" className="flex gap-2">
        <Chip role="radio" aria-checked={kind === "expense"} selected={kind === "expense"} onClick={() => setKind("expense")}>
          − Pengeluaran
        </Chip>
        <Chip role="radio" aria-checked={kind === "income"} selected={kind === "income"} onClick={() => setKind("income")}>
          + Pemasukan
        </Chip>
      </div>
      {cats.isPending ? (
        <Skeleton className="h-64" />
      ) : cats.isError ? (
        <ErrorState message={errorMessage(cats.error)} onRetry={() => void cats.refetch()} />
      ) : (
        <ul className="divide-y divide-outline overflow-hidden rounded-md border border-outline bg-surface">
          {list.map((c) => (
            <li key={c.id} className={`flex min-h-16 items-center gap-3 px-4 py-2 ${c.hidden ? "opacity-60" : ""}`}>
              <CategoryIcon icon={c.icon} tone={c.color_token} kind={c.kind} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-title text-ink">{c.name}</span>
                <span className="block text-body-small text-ink-muted">
                  {c.is_system ? "Bawaan" : "Buatanmu"}
                  {c.hidden ? " · Disembunyikan" : ""}
                </span>
              </span>
              {!c.is_system && (
                <Button variant="ghost" onClick={() => setEditing(c)} aria-label={`Ubah nama ${c.name}`}>
                  Ubah
                </Button>
              )}
              <button
                type="button"
                onClick={() => toggleHidden(c)}
                aria-label={c.hidden ? `Tampilkan ${c.name}` : `Sembunyikan ${c.name}`}
                aria-pressed={c.hidden}
                className="flex size-12 items-center justify-center rounded-full text-ink-muted hover:bg-surface-variant"
              >
                {c.hidden ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && <CategorySheet key={editing === "new" ? "new" : editing.id} category={editing === "new" ? null : editing} kind={kind} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CategorySheet({ category, kind, onClose }: { category: Category | null; kind: Kind; onClose: () => void }) {
  const save = useSaveCategory();
  const toast = useToast();
  const [name, setName] = useState(category?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Nama kategori belum diisi.");
      return;
    }
    try {
      await save.mutateAsync(category ? { id: category.id, body: { name: name.trim() } } : { body: { name: name.trim(), kind } });
      toast({ message: "Kategori disimpan" });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Sheet
      open
      title={category ? "Ubah kategori" : kind === "expense" ? "Kategori pengeluaran baru" : "Kategori pemasukan baru"}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="text-body-small text-expense">
              {error}
            </p>
          )}
          <Button block loading={save.isPending} onClick={() => void submit()}>
            Simpan kategori
          </Button>
        </div>
      }
    >
      <form
        className="pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Nama kategori" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} data-autofocus />
      </form>
    </Sheet>
  );
}
