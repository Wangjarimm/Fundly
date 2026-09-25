// Membuat tangkapan layar portofolio di docs/screenshots/ dari aplikasi lokal.
// Prasyarat: backend (go run ./cmd/server) dan `node scripts/serve-dist.cjs` berjalan.
// Jalankan: node scripts/screenshots.mjs   (PW_CHANNEL=msedge di Windows tanpa unduhan Chromium)
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, request } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:4174";
const OUT = fileURLToPath(new URL("../../../docs/screenshots/", import.meta.url));
mkdirSync(OUT, { recursive: true });
const H = { "X-Requested-With": "fundly" };

const today = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()));
const day = (offset) => {
  const d = new Date(today);
  d.setUTCDate(Math.max(1, today.getUTCDate() - offset));
  return d.toISOString().slice(0, 10);
};

// --- Isi akun demo ---
const api = await request.newContext({ baseURL: BASE });
const email = `demo-${Date.now()}@contoh.com`;
const reg = await api.post("/api/v1/auth/register", { headers: H, data: { email, password: "rahasia123", display_name: "Rina" } });
if (!reg.ok()) throw new Error(`register: ${reg.status()}`);
const cats = (await (await api.get("/api/v1/categories")).json()).items;
const cat = (name, kind = "expense") => cats.find((c) => c.name === name && c.kind === kind).id;
const tunai = (await (await api.get("/api/v1/wallets")).json()).items[0].id;
const mk = async (data) => (await api.post("/api/v1/wallets", { headers: H, data })).json();
await api.patch(`/api/v1/wallets/${tunai}`, { headers: H, data: { initial_balance: 400_000 } });
const bca = await mk({ name: "BCA", type: "bank", provider: "BCA", initial_balance: 2_500_000 });
const gopay = await mk({ name: "GoPay", type: "ewallet", provider: "GoPay", initial_balance: 350_000 });

const txs = [
  [bca.id, "income", 6_200_000, 20, "Gaji September", cat("Gaji", "income")],
  [gopay.id, "expense", 25_000, 0, "Warung Bu Siti", cat("Makanan")],
  [bca.id, "expense", 78_500, 0, "Indomaret", cat("Belanja")],
  [gopay.id, "expense", 18_000, 1, "Kopi Kenangan", cat("Makanan")],
  [tunai, "expense", 35_000, 1, "Bensin Pertalite", cat("Transport")],
  [bca.id, "expense", 450_000, 3, "Token listrik PLN", cat("Tagihan")],
  [bca.id, "expense", 1_250_000, 18, "Sewa kost", cat("Rumah")],
  [gopay.id, "expense", 42_000, 4, "GoFood nasi padang", cat("Makanan")],
  [bca.id, "expense", 320_000, 6, "Belanja bulanan", cat("Belanja")],
  [gopay.id, "expense", 27_000, 7, "Gojek ke kantor", cat("Transport")],
  [bca.id, "income", 750_000, 9, "Transfer klien freelance", cat("Usaha", "income")],
  [tunai, "expense", 50_000, 10, "Infak Jumat", cat("Zakat/Donasi")],
  [bca.id, "expense", 185_000, 12, "Apotek", cat("Kesehatan")],
  [gopay.id, "expense", 65_000, 14, "Bioskop", cat("Hiburan")],
];
for (const [wallet_id, kind, amount, back, merchant, category_id] of txs) {
  await api.post("/api/v1/transactions", { headers: H, data: { wallet_id, kind, amount, occurred_on: day(back), merchant, category_id } });
}
const month = day(0).slice(0, 7);
await api.put(`/api/v1/budgets/${cat("Makanan")}?month=${month}`, { headers: H, data: { limit_amount: 120_000 } });
await api.put(`/api/v1/budgets/${cat("Belanja")}?month=${month}`, { headers: H, data: { limit_amount: 600_000 } });
await api.put(`/api/v1/budgets/${cat("Transport")}?month=${month}`, { headers: H, data: { limit_amount: 300_000 } });
const storageState = await api.storageState();
await api.dispose();

// --- Potret ---
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL });
async function shot(name, { width, height, path, dark = false, action }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, storageState, colorScheme: dark ? "dark" : "light", locale: "id-ID", timezoneId: "Asia/Jakarta" });
  const page = await ctx.newPage();
  await page.goto(BASE + path);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await page.waitForTimeout(900);
  if (action) await action(page);
  await page.screenshot({ path: `${OUT}${name}.png` });
  await ctx.close();
  console.log(`${name}.png`);
}

await shot("hp-beranda", { width: 390, height: 844, path: "/" });
await shot("hp-catat", {
  width: 390,
  height: 844,
  path: "/",
  action: async (p) => {
    await p.getByRole("button", { name: "Tambah transaksi" }).click();
    for (const k of ["2", "5", "000"]) await p.getByRole("group", { name: "Papan angka" }).getByRole("button", { name: k, exact: true }).click();
    await p.getByLabel(/Nama toko/).fill("Indomaret Point");
    await p.getByRole("button", { name: /Disarankan/ }).waitFor();
  },
});
await shot("hp-transaksi", { width: 390, height: 844, path: "/transaksi" });
await shot("hp-laporan-gelap", { width: 390, height: 844, path: "/laporan", dark: true });
await shot("desktop-beranda", { width: 1366, height: 820, path: "/" });
await shot("desktop-laporan", { width: 1366, height: 820, path: "/laporan" });
await shot("desktop-anggaran-gelap", { width: 1366, height: 820, path: "/anggaran", dark: true });
await browser.close();
