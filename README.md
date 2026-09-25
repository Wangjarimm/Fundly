<p align="center">
  <img src="apps/web/public/brand/logo-horizontal.svg" alt="Fundly" height="56">
</p>

<p align="center"><strong>Kelola dana, sederhana.</strong><br>
Pencatat keuangan pribadi berbasis web (PWA) yang ringan, cepat di HP spek rendah, dan tetap bisa dipakai saat offline.</p>

<p align="center">
  <a href="https://fundly-six.vercel.app">fundly-six.vercel.app</a> ·
  <a href="docs/STUDI_KASUS.md">Studi kasus</a> ·
  <a href="PRD.md">PRD</a> ·
  <a href="DESIGN.md">Sistem desain</a> ·
  <a href="docs/SECURITY_CHECKLIST.md">Checklist keamanan</a>
</p>

<p align="center">
  <img src="docs/screenshots/hp-beranda.png" alt="Beranda di HP" width="220">
  <img src="docs/screenshots/hp-catat.png" alt="Catat transaksi dengan keypad" width="220">
  <img src="docs/screenshots/hp-laporan-gelap.png" alt="Laporan bulanan, mode gelap" width="220">
</p>

## Fitur

- **Catat dalam hitungan detik.** Keypad angka besar, dompet terakhir otomatis terpilih, tanggal hari ini. Alur tercepat: ketuk +, ketik jumlah, simpan.
- **Kategori otomatis.** Mengetik "Indomaret" langsung menyarankan *Belanja*. Koreksi pengguna disimpan sebagai aturan pribadi dan selalu diutamakan.
- **Dompet tunai, bank, dan e-wallet** (GoPay, OVO, DANA, ShopeePay). Saldo dihitung dari saldo awal ditambah uang masuk dikurangi uang keluar.
- **Laporan bulanan** berisi ringkasan, pengeluaran per kategori, tren harian, dan perbandingan netral dengan bulan lalu. Transaksi bisa diekspor ke CSV.
- **Anggaran per kategori** dengan status *Aman*, *Hampir habis*, dan *Terlampaui*. Status ditandai ikon dan teks, bukan hanya warna. Anggaran bisa disalin otomatis dari bulan lalu.
- **PWA yang bisa dipakai offline.** Aplikasi bisa dipasang di layar utama dan data terakhir tetap bisa dibuka tanpa internet. Transaksi yang dicatat saat offline masuk antrean dan dikirim sekali saja begitu tersambung (idempoten lewat `client_id`).
- **Satu basis kode untuk semua layar**: navigasi bawah di HP, rail di tablet, sidebar di desktop, plus mode gelap dan aksesibilitas WCAG 2.2 AA.
- **Data milik pengguna.** Semua data bisa diekspor, akun bisa dihapus permanen, dan tersedia kebijakan privasi.

<p align="center">
  <img src="docs/screenshots/desktop-beranda.png" alt="Beranda di desktop" width="760">
</p>

## Angka

| Metrik | Target (PRD) | Hasil |
|---|---|---|
| Lighthouse Performance (mobile, throttled) | ≥ 90 | 96–99 (produksi `/masuk`: 99) |
| Lighthouse Accessibility | ≥ 95 | 100 di semua halaman utama |
| JavaScript awal (gzip) | ≤ 150 KB | ±100 KB |
| Responsif 360–1920 px tanpa scroll horizontal | semua layar | diuji otomatis di 5 viewport dan teks 200% |
| Biaya infrastruktur | Rp 0 | Rp 0 (Vercel Hobby + Supabase Free, tanpa kartu) |

## Arsitektur

```
Browser (React PWA)  ──HTTPS──▶  Vercel (satu proyek, satu domain)
  service worker (precache)         ├─ service web : apps/web  (Vite, statis)
  cache IndexedDB + antrean offline └─ service api : api/      (Go, chi, mode server)
                                                   │ pgx, pool kecil, tanpa prepared statement
                                                   ▼
                                    Supabase Postgres (Singapura), transaction pooler
                                    RLS aktif di semua tabel, hak Data API dicabut

GitHub Actions: ci (lint, tes, E2E, Lighthouse) · migrate (goose, session pooler)
                keepalive (harian) · security (mingguan) · backup (mingguan, terenkripsi)
```

| Lapisan | Pilihan |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4, TanStack Query, wouter, Zod, vite-plugin-pwa |
| Backend | Go, chi, pgx, sqlc, goose, oapi-codegen, argon2id, OAuth Google (PKCE) |
| Kontrak | OpenAPI 3.1 (`api-spec/openapi.yaml`) → tipe Go dan TypeScript dibuat otomatis; CI gagal bila tidak sinkron |
| Data | PostgreSQL 17 (lokal Docker) / Supabase (produksi) |
| Hosting | Vercel Hobby dengan Vercel Services (Go runtime, Beta) |
| Tes | `go test` + Postgres sungguhan, Vitest, Playwright (alur utama, offline, cold start, 5 viewport), Lighthouse CI |

## Struktur

```
api/                     backend Go (go.mod sendiri)
  cmd/server/            entry point: baca PORT, jalankan router
  cmd/migrate/           migrasi goose (lokal dan GitHub Actions)
  internal/http/         router, handler, middleware (sesi, CSRF, rate limit, header keamanan)
  internal/service/      logika bisnis
  internal/auth/         argon2id, token sesi, OAuth Google
  internal/categorize/   kategori otomatis
  internal/db/           koneksi pgx, migrasi, query sqlc
api-spec/openapi.yaml    kontrak API
apps/web/                frontend PWA (src/pages, src/components, src/offline, e2e/)
docs/                    studi kasus, checklist keamanan, tangkapan layar
scripts/                 cek RLS Data API, role tiruan Supabase, init DB lokal
vercel.json              service web (/) dan api (/api/*), header keamanan
.github/workflows/       ci, migrate, keepalive, security, backup
```

## Menjalankan secara lokal

Prasyarat: Go 1.26+, Node 22+, Docker Desktop.

```powershell
# 1. Postgres lokal (database fundly + fundly_test, role tiruan Supabase)
docker compose up -d --wait db

# 2. Backend
cd api
$env:DATABASE_URL = "postgres://fundly:fundly@localhost:5432/fundly?sslmode=disable"
go run ./cmd/migrate
go run ./cmd/server                 # http://localhost:8080/api/v1/healthz

# 3. Frontend (terminal lain)
cd apps/web
npm install
npm run dev                         # http://localhost:5173 (proxy /api → :8080)
```

Salin `.env.example` ke `.env` bila perlu. Isi hanya nilai lokal; rahasia produksi tidak pernah disimpan di laptop.

### Tes

```powershell
# Backend (unit + integrasi dengan Postgres sungguhan)
cd api
$env:TEST_DATABASE_URL = "postgres://fundly:fundly@localhost:5432/fundly_test?sslmode=disable"
go test ./...
golangci-lint run ./...

# Frontend
cd apps/web
npm run lint; npm test; npm run build; npm run check:bundle
npm run e2e                         # di Windows tanpa unduhan browser: $env:PW_CHANNEL="msedge"
```

### Kode hasil generate

```powershell
cd api; go generate ./...                                   # tipe Go dari OpenAPI
cd apps/web; npm run gen:api                                # tipe TypeScript dari OpenAPI
docker run --rm -v "${PWD}/api/internal/db:/src" -w /src sqlc/sqlc:1.30.0 generate   # sqlc (butuh cgo → Docker)
cd apps/web; npm run brand                                  # logo, favicon, ikon PWA, OG image
```

## Deploy dan operasional

- **Deploy:** integrasi Git Vercel. Push ke `main` masuk produksi, dan setiap pull request mendapat preview deployment (dilindungi Deployment Protection).
- **Migrasi:** `migrate.yml` menjalankan goose ke Supabase lewat session pooler saat file migrasi berubah di `main`. Migrasi selalu dibuat aditif, karena urutan antara deploy dan migrasi tidak dijamin.
- **Keep-alive:** `keepalive.yml` memanggil `/api/v1/healthz` (`SELECT 1`) setiap hari agar proyek Supabase gratis tidak dijeda setelah 7 hari tanpa aktivitas.
- **Keamanan:** `security.yml` setiap minggu memeriksa bahwa Data API Supabase tidak mengembalikan data dengan kunci publik dan bahwa header keamanan produksi terpasang.
- **Cadangan:** `backup.yml` setiap minggu menjalankan `pg_dump`, mengompresnya dengan gzip, lalu mengenkripsinya dengan GPG AES-256 sebagai artifact 30 hari. Repositori ini publik, jadi cadangan wajib dienkripsi.
- **Rahasia** hanya ada di Vercel Environment Variables (`DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_BASE_URL`) dan GitHub Secrets (`MIGRATION_DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BACKUP_PASSPHRASE`).

### Catatan cold start

Backend berjalan sebagai fungsi serverless. Setelah lama tidak dipakai, permintaan pertama bisa butuh beberapa detik. Fundly menanganinya dengan beberapa cara:
- cangkang aplikasi di-precache oleh service worker sehingga layar tampil seketika;
- data terakhir dilihat diambil dari IndexedDB;
- klien API memakai timeout 20 detik dan retry dengan backoff;
- indikator "Menyambungkan…" muncul bila respons lebih dari sekitar 2 detik;
- transaksi yang dicatat saat server belum siap masuk antrean lokal dan dikirim otomatis nanti.

### Batasan paket gratis

- **Vercel Hobby** hanya untuk pemakaian pribadi dan non-komersial. Sebelum Fundly dijual (menerima pembayaran, memasang iklan, atau dipakai sebagai bagian dari usaha), tingkatkan dulu ke paket Pro. Tidak ada metode pembayaran yang disimpan di Vercel, jadi bila kuota habis layanan berhenti sementara, tidak menimbulkan tagihan.
- **Supabase Free:** 500 MB database, dan proyek dijeda setelah 7 hari tanpa aktivitas (ditangani oleh keep-alive).
- Pantau pemakaian kuota di dashboard Vercel dan Supabase secara berkala (lihat [checklist](docs/SECURITY_CHECKLIST.md)).

## Status roadmap

| Tahap | Isi |
|---|---|
| M0 Fondasi | Struktur repositori, Docker Compose, migrasi + RLS, OpenAPI, CI, deploy Vercel + Supabase, keep-alive |
| M1 Backend inti | Auth email + Google, sesi, dompet, kategori + saran otomatis, transaksi (idempoten, soft delete, kursor), isolasi antarpengguna |
| M2 Frontend inti | Shell responsif, masuk/daftar, beranda, catat dan daftar transaksi, logo "Koin", matriks viewport |
| M3 Laporan dan anggaran | Laporan bulanan (agregat SQL), anggaran + salin otomatis, ekspor CSV, dompet/kategori/pengaturan/privasi |
| M4 PWA dan offline | Service worker, cache offline, antrean transaksi idempoten, indikator koneksi, tes mode pesawat dan cold start |
| M5 Produksi | CSP dan header keamanan, pencabutan hak Data API, cek RLS mingguan, cadangan terenkripsi, halaman status |
| M6 Portofolio | Lighthouse CI, README, studi kasus, tangkapan layar |

Fase 2 (foto struk, patungan) dan Fase 3 (impor mutasi, premium) belum dikerjakan. Lihat [PRD](PRD.md).

## Lisensi

Proyek portofolio. Hak cipta © 2026 pemilik repositori. Nama dan logo "Fundly" perlu dicek ketersediaan mereknya sebelum dipakai untuk kepentingan komersial (PRD bagian 15).
