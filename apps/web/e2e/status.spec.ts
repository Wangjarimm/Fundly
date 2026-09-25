import { expect, test } from "@playwright/test";

test("halaman status: server dan database tersambung", async ({ page }) => {
  await page.goto("/status");
  await expect(page.getByRole("heading", { name: "Status layanan" })).toBeVisible();
  await expect(page.getByText("Tersambung")).toHaveCount(2);
});

test("halaman status: database tidak bisa dihubungi", async ({ page }) => {
  await page.route("**/api/v1/healthz", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "db_unavailable", message: "Database belum bisa dihubungi." } }),
    }),
  );
  await page.goto("/status");
  // Klien mengulang 503 dengan backoff sebelum menyerah (±7 detik).
  await expect(page.getByText(/Database sedang tidak bisa dihubungi/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Coba lagi" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
