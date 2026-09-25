// Tanggal transaksi berupa tanggal lokal pengguna (default Asia/Jakarta, PRD bagian 8).

export const TIME_ZONE = "Asia/Jakarta";

function partsIn(date: Date): { y: number; m: number; d: number } {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
  const [y, m, d] = f.format(date).split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Hari ini di zona Jakarta, format YYYY-MM-DD. */
export function todayISO(now = new Date()): string {
  const { y, m, d } = partsIn(now);
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Bulan ini di zona Jakarta, format YYYY-MM. */
export function currentMonth(now = new Date()): string {
  return todayISO(now).slice(0, 7);
}

/** Geser bulan YYYY-MM sebanyak delta. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y! * 12 + (m! - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** "2026-09" → "September 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m! - 1]} ${y}`;
}

/** Tanggal panjang: "Jumat, 25 September 2026". */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return `${DAYS[dow]}, ${d} ${MONTHS[m! - 1]} ${y}`;
}

/** Judul grup harian: "Hari ini", "Kemarin", atau "Senin, 21 September". */
export function dayHeading(iso: string, now = new Date()): string {
  const today = todayISO(now);
  if (iso === today) return "Hari ini";
  const [y, m, d] = today.split("-").map(Number);
  const yesterday = new Date(Date.UTC(y!, m! - 1, d! - 1)).toISOString().slice(0, 10);
  if (iso === yesterday) return "Kemarin";
  const full = longDate(iso);
  return iso.slice(0, 4) === today.slice(0, 4) ? full.replace(/ \d{4}$/, "") : full;
}

/** Sapaan sesuai jam di Jakarta. */
export function greeting(now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hour12: false }).format(now));
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}
