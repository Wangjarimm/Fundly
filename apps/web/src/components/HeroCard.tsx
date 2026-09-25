import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatRupiah, groupThousands } from "../lib/money";

// Satu ubin kawung kecil yang diulang (DESIGN.md: pola hanya di kartu hero, opasitas ~8%).
const KAWUNG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cg fill='%23fff'%3E%3Cellipse cx='24' cy='12' rx='6' ry='11'/%3E%3Cellipse cx='24' cy='36' rx='6' ry='11'/%3E%3Cellipse cx='12' cy='24' rx='11' ry='6'/%3E%3Cellipse cx='36' cy='24' rx='11' ry='6'/%3E%3C/g%3E%3C/svg%3E")`;

/** Kartu hero "Sisa uang": jangkar visual beranda (DESIGN.md). */
export function HeroCard({ balance, income, expense, loading }: { balance: number; income: number; expense: number; loading?: boolean }) {
  return (
    <section aria-label="Ringkasan uang" className="relative overflow-hidden rounded-lg bg-hero p-6 text-on-hero">
      <div aria-hidden className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: KAWUNG, backgroundSize: "48px 48px" }} />
      <div className="relative flex flex-col gap-4">
        <div>
          <p className="text-body-small opacity-85">Sisa uang di semua dompet</p>
          <p className="mt-1 break-words font-bold tabular text-[clamp(1.75rem,7vw,2.25rem)] leading-tight tracking-tight" aria-busy={loading}>
            {loading ? "Rp …" : formatRupiah(balance)}
          </p>
        </div>
        <p className="text-body-small opacity-85">Bulan ini</p>
        <div className="-mt-2 grid grid-cols-1 gap-2 min-[440px]:grid-cols-2">
          <Badge kind="income" amount={income} />
          <Badge kind="expense" amount={expense} />
        </div>
      </div>
    </section>
  );
}

function Badge({ kind, amount }: { kind: "income" | "expense"; amount: number }) {
  const income = kind === "income";
  const Icon = income ? ArrowDownLeft : ArrowUpRight;
  return (
    <div className="flex items-center gap-2 rounded-md bg-white/15 p-2.5">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${income ? "bg-income-container text-income" : "bg-expense-container text-expense"}`}>
        <Icon aria-hidden className="size-4" strokeWidth={2.5} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs opacity-85">{income ? "Uang masuk" : "Uang keluar"}</span>
        <span className="block truncate text-label font-bold tabular">
          {income ? "+" : "−"}Rp {groupThousands(amount)}
        </span>
      </span>
    </div>
  );
}
