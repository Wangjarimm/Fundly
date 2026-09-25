// Kalimat banding bulan yang netral: memberi informasi, bukan menilai (DESIGN.md: Copywriting).

export function comparisonText(changePercent: number | null): string {
  if (changePercent === null) return "Belum ada pengeluaran bulan lalu untuk dibandingkan.";
  const pct = Math.abs(changePercent).toLocaleString("id-ID", { maximumFractionDigits: 1 });
  if (changePercent === 0) return "Pengeluaran sama dengan bulan lalu.";
  return changePercent > 0 ? `Pengeluaran naik ${pct}% dari bulan lalu.` : `Pengeluaran turun ${pct}% dari bulan lalu.`;
}
