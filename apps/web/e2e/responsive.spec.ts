import { expect, test } from "@playwright/test";
import { STORAGE_STATE } from "./global-setup";

// F-13 KP7: matriks viewport. Tidak boleh ada scroll horizontal, dan
// navigasi berubah sesuai breakpoint (bawah < 768, rail/sidebar ≥ 768).
const VIEWPORTS = [
  { width: 360, height: 800, nav: "bottom" },
  { width: 390, height: 844, nav: "bottom" },
  { width: 768, height: 1024, nav: "side" },
  { width: 1366, height: 768, nav: "side" },
  { width: 1920, height: 1080, nav: "side" },
] as const;

const PAGES = ["/", "/transaksi", "/laporan", "/lainnya"];

async function expectNoHorizontalScroll(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "halaman tidak boleh bisa di-scroll horizontal").toBeLessThanOrEqual(0);
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}×${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, storageState: STORAGE_STATE });

    test("layar utama rapi dan navigasi sesuai breakpoint", async ({ page }) => {
      for (const path of PAGES) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoHorizontalScroll(page);
        if (vp.nav === "bottom") {
          await expect(page.getByTestId("bottom-nav")).toBeVisible();
          await expect(page.getByTestId("side-nav")).toBeHidden();
        } else {
          await expect(page.getByTestId("side-nav")).toBeVisible();
          await expect(page.getByTestId("bottom-nav")).toBeHidden();
        }
      }
    });

    test("form transaksi: bottom sheet di HP, dialog di layar lebar", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: vp.nav === "bottom" ? "Tambah transaksi" : "Catat" }).click();
      const dialog = page.getByRole("dialog", { name: "Catat transaksi" });
      await expect(dialog).toBeVisible();
      await expectNoHorizontalScroll(page);
      const box = (await dialog.boundingBox())!;
      if (vp.nav === "bottom") {
        expect(Math.round(box.x)).toBe(0);
        expect(Math.round(box.width)).toBe(vp.width);
        await expect(page.getByRole("group", { name: "Papan angka" })).toBeVisible();
      } else {
        expect(box.width).toBeLessThanOrEqual(520);
        expect(box.x).toBeGreaterThan(0);
      }
      // Tombol simpan terlihat tanpa scroll (zona jempol / tidak terpotong bilah alamat).
      await expect(page.getByTestId("save-transaction")).toBeInViewport();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    });
  });
}

test.describe("halaman masuk", () => {
  for (const vp of VIEWPORTS) {
    test(`tanpa scroll horizontal di ${vp.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/masuk");
      await expect(page.getByRole("heading", { name: "Masuk" })).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }
});

test("tata letak tetap rapi pada teks 200%", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, storageState: STORAGE_STATE });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await ctx.close();
});
