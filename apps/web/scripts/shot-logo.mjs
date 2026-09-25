// Tangkapan layar halaman pratinjau konsep logo (hanya untuk peninjauan lokal).
import { chromium } from "@playwright/test";
import { fileURLToPath, pathToFileURL } from "node:url";

const page_ = fileURLToPath(new URL("../public/brand/concepts/index.html", import.meta.url));
const out = process.argv[2] ?? "logo-concepts.png";
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(page_).href);
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(out);
