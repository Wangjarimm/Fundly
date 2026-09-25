import { expect, test } from "@playwright/test";

// Alur utama M2: daftar → catat transaksi (≤ 3 ketuk setelah membuka) →
// terlihat di beranda dan daftar → ubah → hapus → batalkan.
test("daftar, catat, lihat, ubah, hapus dan batalkan", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const email = `alur-${Date.now()}@contoh.com`;

  await page.goto("/");
  await expect(page).toHaveURL(/\/masuk$/);
  await page.getByRole("link", { name: "Daftar" }).click();
  await page.getByLabel("Nama panggilan (opsional)").fill("Dewi");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("rahasia123");
  await page.getByRole("button", { name: "Daftar" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Dewi");
  await expect(page.getByText("Belum ada catatan bulan ini.")).toBeVisible();

  // Catat cepat: ketuk +, ketik jumlah lewat keypad, simpan.
  const started = Date.now();
  await page.getByRole("button", { name: "Tambah transaksi" }).click();
  const keypad = page.getByRole("group", { name: "Papan angka" });
  for (const k of ["8", "7", "5", "000"]) await keypad.getByRole("button", { name: k, exact: true }).click();
  await expect(page.getByLabel("Jumlah")).toHaveValue("875.000");
  await keypad.getByRole("button", { name: "Hapus satu angka" }).click();
  await keypad.getByRole("button", { name: "0", exact: true }).click();
  await page.getByTestId("save-transaction").click();
  await expect(page.getByRole("status").filter({ hasText: "Transaksi disimpan" })).toBeVisible();
  expect(Date.now() - started, "mencatat transaksi ≤ 10 detik").toBeLessThan(10_000);

  // Terlihat di beranda (saldo dan daftar terbaru).
  await expect(page.getByText("−Rp 875.000").first()).toBeVisible();
  await expect(page.getByText("−Rp 875.000", { exact: true }).first()).toBeVisible();

  // Transaksi kedua dengan nama toko: saran kategori muncul.
  await page.getByRole("button", { name: "Tambah transaksi" }).click();
  await page.getByLabel("Jumlah").fill("25000");
  await page.getByLabel(/Nama toko/).fill("Indomaret Point");
  await expect(page.getByRole("button", { name: /Disarankan: Belanja/ })).toBeVisible();
  await page.getByRole("button", { name: /Disarankan: Belanja/ }).click();
  await page.getByLabel("Jumlah").press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Transaksi disimpan" })).toBeVisible();

  // Daftar transaksi, pencarian.
  await page.getByRole("link", { name: "Transaksi" }).click();
  await expect(page.getByRole("heading", { name: "Transaksi", level: 1 })).toBeVisible();
  const row = page.getByRole("button", { name: /Indomaret Point/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Belanja");
  await page.getByLabel("Cari transaksi").fill("indomaret");
  await expect(page.getByRole("button", { name: /^Uang keluar.*−Rp 875\.000/ })).toBeHidden();
  await page.getByLabel("Cari transaksi").fill("");

  // Ubah jumlah.
  await row.click();
  await expect(page.getByRole("dialog", { name: "Ubah transaksi" })).toBeVisible();
  await page.getByLabel("Jumlah").fill("30000");
  await page.getByTestId("save-transaction").click();
  await expect(page.getByRole("button", { name: /Indomaret Point.*−Rp 30.000/ })).toBeVisible();

  // Hapus lalu batalkan lewat toast.
  await page.getByRole("button", { name: /Indomaret Point/ }).click();
  await page.getByRole("button", { name: "Hapus transaksi" }).click();
  await expect(page.getByRole("button", { name: /Indomaret Point/ })).toBeHidden();
  await page.getByRole("button", { name: "Batalkan" }).click();
  await expect(page.getByRole("button", { name: /Indomaret Point/ })).toBeVisible();

  // Keluar.
  await page.getByRole("link", { name: "Lainnya" }).click();
  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/masuk$/);
});

test("pesan error ramah untuk login salah", async ({ page }) => {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill("bukan-email");
  await page.getByLabel("Password").fill("x");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByText("Format email belum benar.")).toBeVisible();

  await page.getByLabel("Email").fill(`tidak-ada-${Date.now()}@contoh.com`);
  await page.getByLabel("Password").fill("rahasia123");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("alert")).toContainText("Email atau password belum cocok");
});
