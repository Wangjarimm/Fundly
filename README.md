# Fundly

Pencatat keuangan pribadi berbasis web (PWA) yang ringan, untuk semua orang. "Kelola dana, sederhana."

Dokumen utama: [`PRD.md`](PRD.md) (kebutuhan dan keputusan), [`DESIGN.md`](DESIGN.md) (sistem desain), [`PANDUAN_MULAI.md`](PANDUAN_MULAI.md) (urutan pengerjaan), [`CLAUDE.md`](CLAUDE.md) (aturan kerja).

## Stack

- **Backend:** Go, chi, pgx, sqlc, goose. Satu aplikasi server di `api/` (`api/cmd/server`).
- **Frontend:** React + Vite + TypeScript + Tailwind (PWA), di `apps/web/` (mulai M2).
- **Database:** PostgreSQL. Lokal lewat Docker Compose, produksi di Supabase (hanya sebagai Postgres, RLS aktif di semua tabel).
- **Hosting:** Vercel Hobby (Go runtime, Beta) dan GitHub Actions untuk CI dan migrasi.

## Struktur

```
api/                     backend Go (go.mod sendiri)
  cmd/server/            entry point: baca PORT, jalankan router
  cmd/migrate/           jalankan migrasi goose (lokal dan GitHub Actions)
  internal/http/         router, handler, middleware
  internal/db/           koneksi pgx, migrasi, query sqlc
api-spec/openapi.yaml    kontrak API
apps/web/                frontend Vite (kerangka M0, aplikasi penuh mulai M2)
docker-compose.yml       Postgres lokal
vercel.json              Vercel Services: web (Vite) di /, api (Go) di /api/*
.github/workflows/       ci.yml, migrate.yml, keepalive.yml
```

## Deploy

Vercel men-deploy otomatis dari GitHub (push ke `main` = produksi, pull request = preview). `vercel.json` memakai **Vercel Services** (Beta): service `web` dari `apps/web` dan service `api` dari `api/` (Go runtime, mode server, entry `cmd/server/main.go`). Migrasi database dijalankan `migrate.yml` di GitHub Actions lewat session pooler Supabase; `keepalive.yml` memanggil `/api/v1/healthz` setiap hari.

Rahasia hanya disimpan di Vercel (Environment Variables) dan GitHub Secrets, tidak pernah di repositori.

## Menjalankan secara lokal

Prasyarat: Go 1.26+, Docker Desktop, Node 22+.

```powershell
# 1. Postgres lokal (membuat database fundly dan fundly_test)
docker compose up -d --wait db

# 2. Salin contoh env (nilai lokal saja, jangan isi rahasia produksi)
Copy-Item .env.example .env

# 3. Migrasi dan server (dari folder api/)
cd api
$env:DATABASE_URL = "postgres://fundly:fundly@localhost:5432/fundly?sslmode=disable"
go run ./cmd/migrate
go run ./cmd/server          # http://localhost:8080/api/v1/healthz
```

### Tes

```powershell
cd api
$env:TEST_DATABASE_URL = "postgres://fundly:fundly@localhost:5432/fundly_test?sslmode=disable"
go test ./...
```

Tes integrasi (migrasi, cek RLS di semua tabel `public`, query `SELECT 1`) dilewati bila `TEST_DATABASE_URL` kosong, kecuali di CI.

### Generate kode sqlc

sqlc membutuhkan cgo, jadi di Windows jalankan lewat Docker:

```powershell
docker run --rm -v "${PWD}/api/internal/db:/src" -w /src sqlc/sqlc:1.30.0 generate
```

## Status

| Tahap | Status |
|---|---|
| M0 Fondasi (lokal) | Selesai: struktur, Docker Compose, migrasi + RLS, OpenAPI, sqlc, `/healthz`, CI |
| M0 Deploy kerangka | File siap (`vercel.json`, `migrate.yml`, `keepalive.yml`); menunggu langkah dashboard |
| M1–M6 | Belum |
