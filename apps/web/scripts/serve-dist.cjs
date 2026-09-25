// Server statis dist/ dengan gzip + proxy /api ke backend lokal, meniru penyajian Vercel.
// Dipakai Lighthouse CI (preview Vite tidak mengompres, sehingga skor performa jadi tidak realistis).
// Jalankan: node scripts/serve-dist.cjs   (PORT=4174, API_PORT=8080)
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const dist = path.join(__dirname, "..", "dist");
const types = { ".js": "application/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };

http
  .createServer((req, res) => {
    if (req.url.startsWith("/api/")) {
      const p = http.request({ host: "localhost", port: Number(process.env.API_PORT || 8080), path: req.url, method: req.method, headers: req.headers }, (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      });
      req.pipe(p);
      return;
    }
    let file = path.join(dist, decodeURIComponent(req.url.split("?")[0]));
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, "index.html");
    const ext = path.extname(file);
    const body = fs.readFileSync(file);
    const headers = { "Content-Type": types[ext] || "application/octet-stream" };
    if (req.url.startsWith("/assets/")) headers["Cache-Control"] = "public, max-age=31536000, immutable";
    if ([".js", ".css", ".html", ".svg", ".webmanifest"].includes(ext) && /gzip/.test(req.headers["accept-encoding"] || "")) {
      headers["Content-Encoding"] = "gzip";
      res.writeHead(200, headers);
      res.end(zlib.gzipSync(body));
    } else {
      res.writeHead(200, headers);
      res.end(body);
    }
  })
  .listen(Number(process.env.PORT || 4174), () => console.log(`serve-dist :${process.env.PORT || 4174}`));
