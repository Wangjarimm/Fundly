// Uang selalu bilangan bulat rupiah; format hanya saat ditampilkan (CLAUDE.md).

const MAX_DIGITS = 15; // sesuai batas backend (MaxAmount < 10^15)

/** Mengelompokkan ribuan dengan titik: 87500 → "87.500". */
export function groupThousands(n: number): string {
  const abs = Math.abs(Math.trunc(n));
  return abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Format rupiah lengkap: `Rp 87.500`, `−Rp 25.000`. */
export function formatRupiah(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}Rp ${groupThousands(n)}`;
}

/** Format dengan tanda jenis transaksi: `+Rp 750.000` / `−Rp 25.000`. */
export function formatSigned(amount: number, kind: "income" | "expense"): string {
  return `${kind === "income" ? "+" : "−"}Rp ${groupThousands(amount)}`;
}

/** Format ringkas untuk ruang sempit: `87,5 rb`, `6,5 jt`, `1,2 M`. */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const fmt = (v: number, unit: string) =>
    `${sign}${v.toLocaleString("id-ID", { maximumFractionDigits: 1 })} ${unit}`;
  if (abs >= 1_000_000_000) return fmt(abs / 1_000_000_000, "M");
  if (abs >= 1_000_000) return fmt(abs / 1_000_000, "jt");
  if (abs >= 1_000) return fmt(abs / 1_000, "rb");
  return `${sign}${abs}`;
}

/** Mengambil digit saja dari masukan pengguna ("Rp 87.500" → 87500). */
export function parseDigits(input: string): number {
  const digits = input.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_DIGITS);
  return digits === "" ? 0 : Number(digits);
}

/** Logika keypad: tambah digit / "000" / hapus, dengan batas panjang. */
export function keypadPress(current: number, key: string): number {
  const s = current === 0 ? "" : String(current);
  if (key === "back") {
    const next = s.slice(0, -1);
    return next === "" ? 0 : Number(next);
  }
  if (!/^\d+$/.test(key)) return current;
  const next = (s + key).replace(/^0+/, "");
  if (next.length > MAX_DIGITS) return current;
  return next === "" ? 0 : Number(next);
}
