import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Alur E2E PRD bagian 13: daftar → buat dompet → catat transaksi →
// lihat di laporan → atur anggaran → ekspor CSV.
test("daftar, dompet, catat, laporan, anggaran, ekspor", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/daftar");
  await page.getByLabel("Email").fill(`lengkap-${Date.now()}@contoh.com`);
  await page.getByLabel("Password").fill("rahasia123");
  await page.getByRole("button", { name: "Daftar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Selamat");

  // Buat dompet e-wallet dengan saldo awal.
  await page.getByRole("link", { name: "Lainnya" }).click();
  await page.getByRole("link", { name: /Dompet/ }).click();
  await page.getByRole("button", { name: "Dompet baru" }).click();
  await page.getByLabel("Nama dompet").fill("GoPay Harian");
  await page.getByRole("button", { name: "E-wallet" }).click();
  await page.getByRole("button", { name: "GoPay", exact: true }).click();
  await page.getByLabel("Saldo awal").fill("200000");
  await page.getByRole("button", { name: "Simpan dompet" }).click();
  await expect(page.getByRole("button", { name: /GoPay Harian, saldo Rp 200.000/ })).toBeVisible();

  // Catat pengeluaran berkategori di dompet baru.
  await page.getByRole("button", { name: "Catat" }).click();
  const dialog = page.getByRole("dialog", { name: "Catat transaksi" });
  await dialog.getByLabel("Jumlah").fill("45000");
  await dialog.getByRole("button", { name: "GoPay Harian" }).click();
  await dialog.getByLabel(/Nama toko/).fill("Bakso Pak Kumis");
  await dialog.getByRole("button", { name: "Makanan", exact: true }).click();
  await page.getByTestId("save-transaction").click();
  await expect(page.getByRole("status").filter({ hasText: "Transaksi disimpan" })).toBeVisible();

  // Laporan: total dan rincian kategori.
  await page.getByRole("link", { name: "Laporan" }).click();
  await expect(page.getByText("−Rp 45.000").first()).toBeVisible();
  await expect(page.getByText("Pengeluaran per kategori")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Makanan" })).toContainText("100%");
  await expect(page.getByText("Belum ada pengeluaran bulan lalu untuk dibandingkan.")).toBeVisible();
  await expect(page.getByText(/Pengeluaran terbesar pada tanggal/)).toBeVisible();

  // Anggaran: atur batas Makanan 50.000 → 90% = hampir habis.
  await page.getByRole("link", { name: "Lainnya" }).click();
  await page.getByRole("link", { name: /Anggaran/ }).click();
  await page.getByRole("button", { name: "Atur anggaran Makanan" }).click();
  await page.getByLabel(/Batas bulanan/).fill("50000");
  await page.getByRole("button", { name: "Simpan anggaran" }).click();
  await expect(page.getByText("Hampir habis")).toBeVisible();
  await expect(page.getByText("Rp 45.000 / Rp 50.000")).toBeVisible();
  await expect(page.getByText("Sisa Rp 5.000")).toBeVisible();

  // Beranda menampilkan anggaran yang perlu dilihat.
  await page.getByRole("link", { name: "Beranda" }).click();
  await expect(page.getByRole("heading", { name: "Anggaran yang perlu dilihat" })).toBeVisible();

  // Ekspor CSV dari laporan.
  await page.getByRole("link", { name: "Laporan" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Ekspor CSV" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^fundly-transaksi-\d{4}-\d{2}\.csv$/);
  const csv = readFileSync(await download.path(), "utf8");
  expect(csv).toContain("tanggal,jenis,jumlah,dompet,kategori,toko,catatan,dibuat");
  expect(csv).toContain("pengeluaran,45000,GoPay Harian,Makanan,Bakso Pak Kumis");
});

test("kategori: buat, sembunyikan bawaan; pengaturan: tema dan hapus akun", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const email = `atur-${Date.now()}@contoh.com`;
  await page.goto("/daftar");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("rahasia123");
  await page.getByRole("button", { name: "Daftar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Selamat");

  await page.goto("/kategori");
  await page.getByRole("button", { name: "Kategori baru" }).click();
  await page.getByLabel("Nama kategori").fill("Kucing");
  await page.getByRole("button", { name: "Simpan kategori" }).click();
  await expect(page.getByText("Buatanmu")).toBeVisible();
  await page.getByRole("button", { name: "Sembunyikan Hiburan" }).click();
  await expect(page.getByRole("button", { name: "Tampilkan Hiburan" })).toBeVisible();

  // Kategori tersembunyi tidak muncul di form catat.
  await page.getByRole("button", { name: "Tambah transaksi" }).click();
  await page.getByRole("button", { name: "Semua kategori" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Kucing" })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Hiburan" })).toBeHidden();
  await page.keyboard.press("Escape");

  // Tema gelap.
  await page.goto("/pengaturan");
  await page.getByRole("radio", { name: "Gelap" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("radio", { name: "Terang" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  // Hapus akun.
  await page.getByRole("button", { name: "Hapus akun" }).click();
  const confirm = page.getByRole("button", { name: "Hapus akun permanen" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel(/Ketik "HAPUS"/).fill("HAPUS");
  await confirm.click();
  await expect(page).toHaveURL(/\/masuk$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("rahasia123");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("alert")).toContainText("Email atau password belum cocok");
});

test("kebijakan privasi bisa dibuka tanpa masuk", async ({ page }) => {
  await page.goto("/masuk");
  await page.getByRole("link", { name: "Kebijakan privasi" }).click();
  await expect(page.getByRole("heading", { name: "Kebijakan privasi" })).toBeVisible();
});
