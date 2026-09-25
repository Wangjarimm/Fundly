// Menuliskan hasil Lighthouse CI sebagai anotasi GitHub Actions (terlihat di halaman PR
// tanpa membuka log): skor per URL dan assertion yang gagal.
import { existsSync, readdirSync, readFileSync } from "node:fs";

const dir = ".lighthouseci";
if (!existsSync(dir)) {
  console.log("::error::Folder .lighthouseci tidak ada; Lighthouse tidak berjalan.");
  process.exit(0);
}

const byUrl = new Map();
for (const f of readdirSync(dir).filter((f) => f.startsWith("lhr-") && f.endsWith(".json"))) {
  const lhr = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  const scores = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round((v.score ?? 0) * 100)]));
  const list = byUrl.get(lhr.finalDisplayedUrl) ?? [];
  list.push({ ...scores, lcp: lhr.audits["largest-contentful-paint"]?.displayValue, tbt: lhr.audits["total-blocking-time"]?.displayValue, err: lhr.runtimeError?.message });
  byUrl.set(lhr.finalDisplayedUrl, list);
}
for (const [url, runs] of byUrl) {
  const s = runs.map((r) => `perf ${r.performance} a11y ${r.accessibility} bp ${r["best-practices"]} LCP ${r.lcp} TBT ${r.tbt}${r.err ? ` ERR ${r.err}` : ""}`).join(" | ");
  console.log(`::notice title=Lighthouse ${url}::${s}`);
}

const assertFile = `${dir}/assertion-results.json`;
if (existsSync(assertFile)) {
  for (const a of JSON.parse(readFileSync(assertFile, "utf8")).filter((a) => !a.passed)) {
    console.log(`::error title=Lighthouse ${a.url}::${a.auditProperty ?? a.auditId} ${a.operator} ${a.expected}, didapat ${a.actual}`);
  }
}
