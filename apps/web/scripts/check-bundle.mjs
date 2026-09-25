// Memeriksa anggaran JS awal (PRD bagian 7): ≤ 150 KB gzip.
// JS awal = skrip modul dan modulepreload yang dirujuk langsung oleh dist/index.html.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const BUDGET_BYTES = 150 * 1024;
const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const html = readFileSync(join(dist, "index.html"), "utf8");

const refs = new Set();
for (const m of html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*rel="modulepreload"[^>]*\shref)="([^"]+\.js)"/g)) {
  refs.add(m[1].replace(/^\//, ""));
}

let total = 0;
for (const ref of refs) {
  const size = gzipSync(readFileSync(join(dist, ref))).length;
  total += size;
  console.log(`${ref}: ${(size / 1024).toFixed(1)} KB gzip`);
}
console.log(`JS awal total: ${(total / 1024).toFixed(1)} KB gzip (batas ${BUDGET_BYTES / 1024} KB)`);

if (refs.size === 0) {
  console.error("Tidak ada skrip yang ditemukan di dist/index.html");
  process.exit(1);
}
if (total > BUDGET_BYTES) {
  console.error("Anggaran bundel terlampaui.");
  process.exit(1);
}
