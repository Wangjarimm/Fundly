import type { MonthlyReport } from "../api/hooks";
import { formatCompact } from "../lib/money";

/**
 * Grafik batang tren pengeluaran harian sebagai SVG biasa (viewBox, skala otomatis).
 * Menggantikan Recharts agar halaman laporan ringan di HP spek rendah
 * (PRD bagian 15: "alternatif grafik SVG sederhana"). Ringkasan teks untuk
 * pembaca layar ditampilkan terpisah oleh halaman laporan.
 */
export default function TrendChart({ daily }: { daily: MonthlyReport["daily"] }) {
  const W = 640;
  const H = 220;
  const pad = { top: 12, right: 8, bottom: 24, left: 48 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(0, ...daily.map((d) => d.expense));
  const niceMax = niceCeil(max);
  const step = innerW / Math.max(1, daily.length);
  const barW = Math.max(2, step * 0.62);
  const ticks = [0, 0.5, 1].map((f) => Math.round(niceMax * f));
  const labelEvery = daily.length > 20 ? 5 : daily.length > 10 ? 2 : 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-hidden="true" focusable="false">
      {ticks.map((t) => {
        const y = pad.top + innerH - (niceMax ? (t / niceMax) * innerH : 0);
        return (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y} y2={y} stroke="var(--c-outline)" strokeWidth={1} />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize={12} fill="var(--c-ink-muted)">
              {formatCompact(t).replace(" ", "")}
            </text>
          </g>
        );
      })}
      {daily.map((d, i) => {
        const h = niceMax ? (d.expense / niceMax) * innerH : 0;
        const x = pad.left + i * step + (step - barW) / 2;
        const day = Number(d.date.slice(8));
        return (
          <g key={d.date}>
            {h > 0 && <rect x={x} y={pad.top + innerH - h} width={barW} height={h} rx={Math.min(3, barW / 2)} fill="var(--c-expense)" />}
            {(day === 1 || day % labelEvery === 0) && (
              <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--c-ink-muted)">
                {day}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Batas atas sumbu yang "bulat" (1, 2, 5 × 10^n). */
function niceCeil(v: number): number {
  if (v <= 0) return 0;
  const exp = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) if (v <= m * exp) return m * exp;
  return 10 * exp;
}
