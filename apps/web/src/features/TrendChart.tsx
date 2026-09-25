import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyReport } from "../api/hooks";
import { formatCompact, formatRupiah } from "../lib/money";

/**
 * Grafik tren pengeluaran harian. Modul ini (dan Recharts) hanya dimuat saat
 * halaman laporan dibuka (F-05 KP4, anggaran bundel PRD bagian 7).
 */
export default function TrendChart({ daily }: { daily: MonthlyReport["daily"] }) {
  const data = daily.map((d) => ({ day: Number(d.date.slice(8)), expense: d.expense }));
  return (
    <div className="h-56 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--c-outline)" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fill: "var(--c-ink-muted)", fontSize: 12 }} />
          <YAxis
            width={52}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatCompact(v).replace(" ", "")}
            tick={{ fill: "var(--c-ink-muted)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "var(--c-surface-variant)" }}
            formatter={(v) => [formatRupiah(Number(v)), "Uang keluar"]}
            labelFormatter={(d) => `Tanggal ${d}`}
            contentStyle={{ background: "var(--c-surface)", border: "1px solid var(--c-outline)", borderRadius: 8, color: "var(--c-ink)" }}
          />
          <Bar dataKey="expense" fill="var(--c-expense)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
