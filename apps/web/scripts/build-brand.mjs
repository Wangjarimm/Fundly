// Membuat semua aset merek Fundly dari satu sumber (F-14, D-19).
// Logo terpilih: konsep 2 "Koin" — F membulat dengan satu titik kunyit.
// Jalankan: npm run brand   (alat hanya devDependency, tidak masuk bundel)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import opentype from "opentype.js";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("..", import.meta.url));
const brandDir = `${root}public/brand`;
const iconDir = `${root}public/icons`;
mkdirSync(brandDir, { recursive: true });
mkdirSync(iconDir, { recursive: true });

const INDIGO = "#2F3E9E";
const INDIGO_TUA = "#1E2A75";
const KUNYIT = "#F5B301";
const KAPUR = "#F5F6FA";
const INK = "#1B2130";

// --- Sumber tunggal: glyph dalam kotak 64×64 (digeser 2,5 agar seimbang optis) ---
const F_PATH = "M19.5 14h22a4.5 4.5 0 0 1 0 9h-16v6h7a4.5 4.5 0 0 1 0 9h-7v7.5a4.5 4.5 0 0 1-9 0V17a3 3 0 0 1 3-3z";
const COIN = { cx: 43.5, cy: 33.5, r: 5 };
const glyph = (fg, accent = KUNYIT) =>
  `<path fill="${fg}" d="${F_PATH}"/><circle cx="${COIN.cx}" cy="${COIN.cy}" r="${COIN.r}" fill="${accent}"/>`;

const svg = (viewBox, body, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${extra}>${body}</svg>\n`;

// Ikon: ubin membulat (rx 16 ≈ rounded.md relatif) + glyph.
const markSvg = svg("0 0 64 64", `<rect width="64" height="64" rx="16" fill="${INDIGO}"/>${glyph("#fff")}`, ' role="img" aria-label="Fundly"');

// --- Wordmark "Fundly" sebagai path (tidak bergantung pada font) ---
function textPath(file, text, size) {
  const buf = readFileSync(require.resolve(`@fontsource/plus-jakarta-sans/files/${file}`));
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  // Tanpa shaping GSUB (belum didukung opentype.js untuk font ini): cukup untuk teks Latin.
  const scale = size / font.unitsPerEm;
  const p = new opentype.Path();
  let x = 0;
  let prev = null;
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    if (prev) {
      const k = Number(font.getKerningValue(prev, g));
      if (Number.isFinite(k)) x += k * scale; // bisa NaN bila kerning hanya di GPOS
    }
    p.extend(g.getPath(x, 0, size));
    x += g.advanceWidth * scale;
    prev = g;
  }
  const bb = p.getBoundingBox();
  return { d: p.toPathData(2), x1: bb.x1, y1: bb.y1, w: bb.x2 - bb.x1, h: bb.y2 - bb.y1, capHeight: (font.tables.os2.sCapHeight / font.unitsPerEm) * size };
}
const word = textPath("plus-jakarta-sans-latin-700-normal.woff", "Fundly", 100);
const wordSvg = (fill) =>
  svg(`${word.x1.toFixed(2)} ${word.y1.toFixed(2)} ${word.w.toFixed(2)} ${word.h.toFixed(2)}`, `<path fill="${fill}" d="${word.d}"/>`, ' role="img" aria-label="Fundly"');

// Logo horizontal: ikon setinggi ~1,55× tinggi huruf kapital, jarak 0,45× ikon.
function horizontal({ tile, fg, accent, text }) {
  const icon = word.capHeight * 1.55;
  const gap = icon * 0.3;
  const s = icon / 64;
  const baselineY = icon / 2 + word.capHeight / 2; // huruf kapital di tengah ikon
  const iconBody = tile
    ? `<rect width="64" height="64" rx="16" fill="${tile}"/>${glyph(fg, accent)}`
    : `<g transform="translate(-11 -8) scale(${(64 / 48).toFixed(4)})">${glyph(fg, accent)}</g>`;
  const w = icon + gap + (word.x1 + word.w);
  const top = Math.min(0, baselineY + word.y1);
  const h = Math.max(icon, baselineY + word.y1 + word.h) - top;
  return svg(
    `0 ${top.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`,
    `<g transform="scale(${s.toFixed(4)})">${iconBody}</g><path fill="${text}" transform="translate(${(icon + gap).toFixed(2)} ${baselineY.toFixed(2)})" d="${word.d}"/>`,
    ' role="img" aria-label="Fundly"',
  );
}

const files = {
  [`${brandDir}/logo-mark.svg`]: markSvg,
  [`${brandDir}/logo-wordmark.svg`]: wordSvg(INDIGO),
  [`${brandDir}/logo-horizontal.svg`]: horizontal({ tile: INDIGO, fg: "#fff", accent: KUNYIT, text: INDIGO }),
  // Satu warna: indigo tua untuk latar terang, putih untuk latar gelap (tanpa ubin).
  [`${brandDir}/logo-mono-dark.svg`]: horizontal({ fg: INDIGO_TUA, accent: INDIGO_TUA, text: INDIGO_TUA }),
  [`${brandDir}/logo-mono-light.svg`]: horizontal({ fg: "#fff", accent: "#fff", text: "#fff" }),
  [`${iconDir}/favicon.svg`]: markSvg,
};
for (const [path, content] of Object.entries(files)) writeFileSync(path, content);

// --- PNG ---
const png = (svgText, width) => new Resvg(svgText, { fitTo: { mode: "width", value: width } }).render().asPng();

// Full-bleed (tanpa sudut transparan) untuk maskable dan apple-touch-icon.
// Zona aman maskable: lingkaran 80% di tengah, jadi glyph diperkecil.
const fullBleed = (scale) =>
  svg("0 0 64 64", `<rect width="64" height="64" fill="${INDIGO}"/><g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${glyph("#fff")}</g>`);

writeFileSync(`${iconDir}/icon-192.png`, png(markSvg, 192));
writeFileSync(`${iconDir}/icon-512.png`, png(markSvg, 512));
writeFileSync(`${iconDir}/icon-maskable-512.png`, png(fullBleed(0.72), 512));
writeFileSync(`${iconDir}/apple-touch-icon.png`, png(fullBleed(0.9), 180));

// favicon.ico: PNG 16/32/48 di dalam kontainer ICO.
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((im) => im.data)]);
}
writeFileSync(`${iconDir}/favicon.ico`, ico([16, 32, 48].map((size) => ({ size, data: png(markSvg, size) }))));

// OG image 1200×630: logo horizontal + tagline di latar kapur.
const tagline = textPath("plus-jakarta-sans-latin-400-normal.woff", "Kelola dana, sederhana.", 44);
const hz = horizontal({ tile: INDIGO, fg: "#fff", accent: KUNYIT, text: INDIGO });
const hzInner = hz.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const hzView = hz.match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);
const hzScale = 640 / hzView[2];
const og = svg(
  "0 0 1200 630",
  `<rect width="1200" height="630" fill="${KAPUR}"/>` +
    `<g transform="translate(96 ${230 - hzView[1] * hzScale}) scale(${hzScale.toFixed(4)})">${hzInner}</g>` +
    `<path fill="${INK}" transform="translate(100 ${230 + hzView[3] * hzScale + 70})" d="${tagline.d}"/>` +
    `<rect x="96" y="560" width="120" height="8" rx="4" fill="${KUNYIT}"/>`,
);
writeFileSync(`${brandDir}/og-image.png`, png(og, 1200));

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(2)} KB`;
console.log(`logo-mark.svg ${kb(markSvg)} (target < 3 KB)`);
console.log("aset merek selesai dibuat");
