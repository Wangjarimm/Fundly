import { expect, test, type Page } from "@playwright/test";

// F-07: PWA, offline, dan cold start. Setiap tes memakai pengguna baru agar
// jumlah transaksi bisa diperiksa tepat (idempotensi).

async function registerFresh(page: Page) {
  const email = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@contoh.com`;
  await page.goto("/daftar");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("rahasia123");
  await page.getByRole("button", { name: "Daftar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Selamat");
  await expect(page.getByText("Tunai").first()).toBeVisible();
}

async function countTransactions(page: Page, amount: number) {
  return page.evaluate(async (amt) => {
    const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()).slice(0, 7);
    const res = await fetch(`/api/v1/transactions?month=${month}&limit=100`);
    const body = await res.json();
    return body.items.filter((t: { amount: number }) => t.amount === amt).length;
  }, amount);
}

async function addExpense(page: Page, amount: string) {
  await page.getByRole("button", { name: "Tambah transaksi" }).click();
  await page.getByRole("dialog").getByLabel("Jumlah").fill(amount);
  await page.getByTestId("save-transaction").click();
}

test("mode pesawat: cangkang dan data terakhir tetap terbuka, transaksi diantrekan lalu tersinkron sekali", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await registerFresh(page);
  // Pastikan service worker aktif dan cache query sudah tersimpan.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(1500);

  await context.setOffline(true);
  await page.reload();
  // Cangkang dari precache SW, data dari cache IndexedDB (F-07 KP2, KP3).
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Selamat");
  await expect(page.getByText("Tunai").first()).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Offline" })).toBeVisible();

  // Catat saat offline → antrean lokal (KP4).
  await addExpense(page, "12345");
  await expect(page.getByText("disimpan di perangkat")).toBeVisible();
  const pendingRow = page.getByRole("listitem").filter({ hasText: "Menunggu sinkron" });
  await expect(pendingRow).toContainText("−Rp 12.345");
  await expect(page.getByRole("status").filter({ hasText: "1 menunggu sinkron" })).toBeVisible();

  // Kembali online → tersinkron otomatis, tepat satu kali.
  await context.setOffline(false);
  await expect(page.getByText("1 transaksi tersinkron")).toBeVisible({ timeout: 20_000 });
  await expect(pendingRow).toBeHidden();
  await expect(page.getByText("−Rp 12.345").first()).toBeVisible();
  expect(await countTransactions(page, 12345)).toBe(1);
});

test("server belum siap saat menyimpan: masuk antrean, lalu terkirim dengan client_id yang sama", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await registerFresh(page);

  // Simulasikan backend dingin/gagal: POST transaksi gagal di jaringan.
  let blocked = true;
  await page.route("**/api/v1/transactions", (route) => {
    if (blocked && route.request().method() === "POST") return route.abort("connectionreset");
    return route.continue();
  });
  await addExpense(page, "7777");
  await expect(page.getByText("disimpan di perangkat")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Menunggu sinkron" })).toBeVisible();

  blocked = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText("1 transaksi tersinkron")).toBeVisible({ timeout: 20_000 });
  expect(await countTransactions(page, 7777)).toBe(1);

  // Kirim ulang antrean yang sama (mis. dua tab) tidak membuat duplikat.
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForTimeout(1000);
  expect(await countTransactions(page, 7777)).toBe(1);
});

test("cold start: indikator Menyambungkan… muncul saat respons lambat, lalu data tampil", async ({ page: first, browser }) => {
  await registerFresh(first);
  // Kunjungan pertama di perangkat ini: sesi sama, tanpa cache IndexedDB dan SW.
  const ctx = await browser.newContext({ storageState: await first.context().storageState(), serviceWorkers: "block", viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  // Semua permintaan API diperlambat 3 detik (lebih dari ambang ~2 detik).
  await page.route("**/api/v1/**", async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });
  await page.goto("/transaksi");
  await expect(page.getByRole("status").filter({ hasText: "Menyambungkan…" })).toBeVisible({ timeout: 6000 });
  await expect(page.getByRole("heading", { name: "Transaksi", level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("status").filter({ hasText: "Menyambungkan…" })).toBeHidden({ timeout: 15_000 });
  await ctx.close();
});

test("backend benar-benar tidak tersedia: halaman error dengan Coba lagi (KP7)", async ({ browser }) => {
  const ctx = await browser.newContext({ serviceWorkers: "block" });
  const page = await ctx.newPage();
  let down = true;
  await page.route("**/api/v1/me", (route) =>
    down
      ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "db_unavailable", message: "Database belum bisa dihubungi. Coba lagi sebentar lagi." } }) })
      : route.continue(),
  );
  await page.goto("/");
  // Klien mengulang dengan backoff (±7 detik) sebelum menyerah.
  await expect(page.getByText("Database belum bisa dihubungi.")).toBeVisible({ timeout: 20_000 });
  down = false;
  await page.getByRole("button", { name: "Coba lagi" }).click();
  await expect(page).toHaveURL(/\/masuk$/);
  await ctx.close();
});
