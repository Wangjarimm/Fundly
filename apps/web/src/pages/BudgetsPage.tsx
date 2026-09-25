import { useState } from "react";
import { errorMessage, useBudgets, useCategories, useDeleteBudget, useMe, usePutBudget, useUpdateMe, type Category } from "../api/hooks";
import { AmountField } from "../components/AmountField";
import { BudgetProgress } from "../components/BudgetProgress";
import { CategoryIcon } from "../components/CategoryIcon";
import { MonthSwitcher } from "../components/MonthSwitcher";
import { Sheet } from "../components/Sheet";
import { Toggle } from "../components/Toggle";
import { useToast } from "../components/Toast";
import { Button, Card, ErrorState, PageTitle, Skeleton } from "../components/ui";
import { currentMonth, monthLabel } from "../lib/date";
import { formatRupiah } from "../lib/money";

/** Anggaran per kategori pengeluaran (F-06). */
export function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth());
  const budgets = useBudgets(month);
  const categories = useCategories();
  const me = useMe();
  const updateMe = useUpdateMe();
  const toast = useToast();
  const [editing, setEditing] = useState<Category | null>(null);

  const byCategory = new Map((budgets.data ?? []).map((b) => [b.category_id, b]));
  const expenseCats = (categories.data ?? []).filter((c) => c.kind === "expense");
  const withBudget = expenseCats.filter((c) => byCategory.has(c.id));
  const without = expenseCats.filter((c) => !byCategory.has(c.id));

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageTitle>Anggaran</PageTitle>
      <MonthSwitcher month={month} onChange={setMonth} />

      <Card className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-label text-ink">Salin anggaran bulan lalu otomatis</p>
          <p className="text-body-small text-ink-muted">Berlaku saat bulan baru belum punya anggaran.</p>
        </div>
        <Toggle
          label="Salin anggaran bulan lalu otomatis"
          checked={me.data?.budget_auto_copy ?? true}
          onChange={(v) => updateMe.mutate({ budget_auto_copy: v }, { onError: (e) => toast({ message: errorMessage(e) }) })}
        />
      </Card>

      {budgets.isPending || categories.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : budgets.isError ? (
        <ErrorState message={errorMessage(budgets.error)} onRetry={() => void budgets.refetch()} />
      ) : (
        <>
          {withBudget.length === 0 && (
            <Card>
              <p className="text-body text-ink">Belum ada anggaran di {monthLabel(month)}. Pilih kategori di bawah untuk mengatur batas bulanan.</p>
            </Card>
          )}
          <ul className="flex flex-col gap-3">
            {withBudget.map((c) => (
              <li key={c.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <CategoryIcon icon={c.icon} tone={c.color_token} kind="expense" />
                    <span className="min-w-0 flex-1 truncate text-title text-ink">{c.name}</span>
                    <Button variant="ghost" onClick={() => setEditing(c)} aria-label={`Ubah anggaran ${c.name}`}>
                      Ubah
                    </Button>
                  </div>
                  <BudgetProgress budget={byCategory.get(c.id)!} />
                </Card>
              </li>
            ))}
          </ul>
          {without.length > 0 && (
            <section aria-labelledby="tanpa-anggaran" className="flex flex-col gap-2">
              <h2 id="tanpa-anggaran" className="text-title text-ink">
                Belum diatur
              </h2>
              <ul className="divide-y divide-outline overflow-hidden rounded-md border border-outline bg-surface">
                {without.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(c)}
                      className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface-variant"
                    >
                      <CategoryIcon icon={c.icon} tone={c.color_token} kind="expense" />
                      <span className="min-w-0 flex-1 truncate text-title text-ink">{c.name}</span>
                      <span className="text-label text-primary">
                        Atur<span className="sr-only"> anggaran</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {editing && (
        <BudgetSheet
          key={editing.id}
          category={editing}
          month={month}
          current={byCategory.get(editing.id)?.limit_amount}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function BudgetSheet({ category, month, current, onClose }: { category: Category; month: string; current?: number; onClose: () => void }) {
  const [limit, setLimit] = useState(current ?? 0);
  const [error, setError] = useState<string | null>(null);
  const put = usePutBudget(month);
  const del = useDeleteBudget(month);
  const toast = useToast();

  async function save() {
    setError(null);
    if (limit <= 0) {
      setError("Batas harus lebih dari 0. Ketik angka lalu simpan.");
      return;
    }
    try {
      await put.mutateAsync({ categoryId: category.id, limit });
      toast({ message: "Anggaran disimpan" });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function remove() {
    try {
      await del.mutateAsync(category.id);
      toast({ message: "Anggaran dihapus" });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Sheet
      open
      title={`Anggaran ${category.name}`}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="text-body-small text-expense">
              {error}
            </p>
          )}
          <Button block loading={put.isPending} onClick={() => void save()}>
            Simpan anggaran
          </Button>
          {current !== undefined && (
            <Button variant="danger" block loading={del.isPending} onClick={() => void remove()}>
              Hapus anggaran
            </Button>
          )}
        </div>
      }
    >
      <form
        className="flex flex-col gap-3 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <AmountField label={`Batas bulanan (${monthLabel(month)})`} value={limit} onChange={setLimit} autoFocus />
        {current !== undefined && <p className="text-body-small text-ink-muted">Batas saat ini {formatRupiah(current)}.</p>}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}
