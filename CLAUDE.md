# CLAUDE.md — aturan kerja Fundly

Ringkasan dari Lampiran B `PRD.md`. Jika ada yang bertentangan, `PRD.md` yang berlaku.

## Umum
- Baca `PRD.md` dan `DESIGN.md` sebelum mengubah kode. Ikuti keputusan bertanda [Dxx]; jika perlu mengubahnya, tanyakan dulu dan perbarui PRD.
- Kerjakan hanya tahap yang diminta (M0, M1, …). Jangan menyentuh fitur Fase 2/3 sebelum diminta.
- Setiap fitur baru wajib disertai tes (Go dan/atau Vitest/Playwright) dan lolos lint.
- Di akhir tiap tahap: jalankan seluruh tes, periksa ukuran bundel, perbarui README, tulis ringkasan apa yang selesai dan apa yang belum.
- Sebelum menyarankan platform atau layanan baru, ingatkan pemilik proyek untuk mengecek kuota gratis terbaru di halaman resminya.
- Gaya caveman (jika skill Caveman dipasang) hanya untuk balasan chat dan pesan commit. Kode, komentar, README, dan teks antarmuka ditulis normal.

## Backend (`api/`)
- Go, chi, pgx, sqlc, goose. Satu aplikasi server; entry point `api/cmd/server/main.go` membaca `PORT` (dipakai lokal dan oleh Go runtime Vercel lewat Vercel Services, lihat `vercel.json`). Jangan dipecah jadi banyak fungsi kecil per endpoint.
- Jangan menaruh file `.go` langsung di akar `api/` selain yang sudah ada; preset Go Vercel mendeteksi `main.go` / `cmd/server/main.go`.
- Jangan menulis SQL string manual di handler; semua query lewat sqlc (`api/internal/db/queries`).
- Setiap query data pengguna wajib menyertakan `user_id` dari sesi.
- Backend stateless: tidak menulis ke disk lokal; sesi di database.
- Kontrak API berasal dari `api-spec/openapi.yaml`. Ubah spesifikasi dulu, jalankan generator, lalu implementasi.
- Error seragam: `{ "error": { "code", "message" } }`.

## Frontend (`apps/web/`)
- React + TypeScript + Vite + Tailwind; tipe API dibuat dari OpenAPI (openapi-typescript); token desain dari `DESIGN.md`.
- JS awal ≤ 150 KB gzip; impor library berat (Recharts, OCR) secara lazy.
- Terapkan penanganan cold start (D-16) di klien API: timeout 15–20 dtk, retry dengan backoff, indikator "Menyambungkan…" setelah ±2 dtk.
- Responsif mobile-first (D-18, tabel breakpoint di `DESIGN.md`); setiap layar baru wajib lolos uji viewport F-13.
- Logo: SVG sesuai "Logo dan identitas" di `DESIGN.md`. Tampilkan 3 konsep dan tunggu pilihan pemilik proyek. Jangan menambah library berat untuk logo atau ikon.

## Uang
- Selalu `BIGINT` rupiah di backend dan bilangan bulat di frontend; format hanya saat ditampilkan (`Rp 87.500`).

## Database
- Supabase hanya sebagai Postgres. Setiap tabel baru wajib `ENABLE ROW LEVEL SECURITY` di migrasi yang sama (tanpa policy).
- Jangan memakai Supabase Auth/Storage/Realtime dan jangan memakai kunci Supabase.
- Produksi: pooler transaction mode, pool sangat kecil, tanpa prepared statement cache (D-13). Migrasi goose dari GitHub Actions lewat session pooler.
- Lokal: Postgres di Docker Compose, backend lewat `go run`.

## Hosting dan rahasia
- Vercel Hobby, tanpa metode pembayaran, non-komersial (D-17). Jangan menjalankan OCR atau pekerjaan berat di backend; jangan menyimpan file di disk fungsi.
- Jangan pernah memasukkan rahasia ke repositori. Pakai variabel lingkungan dan `.env.example`.
- Jangan membaca atau mencetak isi `.env`, dan jangan meminta pemilik proyek menempelkan rahasia ke chat.
- Jangan meminta atau memakai kredensial Vercel, Supabase, atau GitHub Secrets. Tulis hanya file di repositori; langkah dashboard dilakukan pemilik proyek.
- Tidak ada deploy produksi dari laptop (`vercel --prod` dilarang). Produksi berubah lewat push/merge ke `main`.

## Perintah umum
- Postgres lokal: `docker compose up -d db`
- Migrasi lokal: `cd api && go run ./cmd/migrate` (pakai `DATABASE_URL`)
- Backend lokal: `cd api && go run ./cmd/server`
- Tes backend: `cd api && go test ./...` (tes integrasi butuh `TEST_DATABASE_URL`)
- Generate sqlc (butuh cgo, jadi lewat Docker): `docker run --rm -v "${PWD}/api/internal/db:/src" -w /src sqlc/sqlc:1.30.0 generate`
- Generate tipe OpenAPI: `cd api && go generate ./...`
- Lint: `cd api && golangci-lint run ./...`
