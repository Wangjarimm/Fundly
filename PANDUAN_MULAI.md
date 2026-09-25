# Panduan mulai: membangun Fundly dengan Claude Code

Panduan ini mengurutkan langkah dari nol: persiapan sebelum ada folder, menyiapkan repositori, mengatur Claude Code, memasang skill Caveman, sampai sesi coding pertama. Pendampingnya adalah `PRD.md` dan `DESIGN.md`.

> Catatan: langkah pemasangan Claude Code dan aturan izin diambil dari dokumentasi Claude Code per September 2026. Info Caveman berasal dari repositori komunitas yang bisa berubah; cocokkan dengan README terbaru sebelum memasang. Hosting backend memakai **Vercel** dengan Go runtime yang masih berstatus **Beta**; cek dokumentasi Vercel terbaru sebelum deploy.

Centang (`[x]`) tiap langkah yang sudah selesai.

---

## Tahap A: Persiapan sebelum ada folder

### A1. Akun

- [ ] **GitHub**, untuk repositori dan GitHub Actions.
- [ ] **Akun Claude** yang bisa dipakai untuk Claude Code (cek syarat paketnya di dokumentasi Claude Code).
- [ ] **Supabase**: buat proyek dengan region **Singapore**. Simpan password database di password manager, bukan di chat dan bukan di file proyek.
- [ ] **Vercel**: daftar lewat GitHub, paket **Hobby**. **Jangan menambahkan metode pembayaran.** Ingat: paket Hobby menurut ketentuan layanannya untuk pemakaian pribadi/non-komersial (lihat PRD D-17); untuk portofolio ini tidak masalah.
- [ ] **Google Cloud Console** untuk kredensial Google OAuth: boleh ditunda sampai tahap M1. Mulai dulu dengan login email. Membuat kredensial OAuth saja tidak memerlukan billing aktif, tapi lewati saja kalau ada ajakan trial/kartu.
- [ ] **Google Stitch** untuk desain UI (unggah `DESIGN.md` di sana).

### A2. Alat di laptop Windows

Cek dulu apa yang sudah terpasang:

```powershell
git --version
go version
node -v
docker --version
```

Pasang yang belum ada (lewat winget, atau unduh dari situs resminya):

```powershell
winget install Git.Git
winget install GoLang.Go
winget install OpenJS.NodeJS.LTS
```

- [ ] Docker Desktop terpasang dan `.wslconfig` sudah diatur seperti di PRD bagian 12 (contoh hemat: `memory=2GB`, `processors=2`, `swap=1GB`, lalu `wsl --shutdown`). Docker di sini hanya untuk Postgres lokal, bukan untuk deploy.
- [ ] Tutup dan buka lagi terminal setelah memasang alat, supaya PATH terbaca.
- [ ] (Opsional, tidak wajib) Vercel CLI: `npm install -g vercel`, dipakai sesekali untuk `vercel dev` atau melihat log. Alur kerja utama tetap lewat integrasi Git bawaan Vercel (push ke `main` = deploy otomatis), bukan lewat CLI.

### A3. Pasang Claude Code

Cara yang direkomendasikan di Windows adalah pemasangan native lewat PowerShell (tanpa hak administrator):

```powershell
irm https://claude.ai/install.ps1 | iex
```

Alternatif: `winget install Anthropic.ClaudeCode`. Lalu cek:

```powershell
claude --version
```

Tentang lingkungan:
- **Windows native** (disarankan untuk pemula): lebih sederhana. Git for Windows disarankan agar Claude Code bisa memakai Bash tool; tanpa Git, ia memakai PowerShell. Sandboxing tidak didukung di mode ini.
- **WSL 2**: mendukung sandboxing, tapi pasang dan jalankan `claude` di dalam terminal WSL, dan simpan proyek di filesystem Linux (bukan di `/mnt/c/`) agar cepat.

---

## Tahap B: Siapkan folder dan repositori

1. Buat folder di lokasi biasa, **bukan** di folder yang disinkronkan OneDrive:

   ```powershell
   mkdir C:\dev\fundly
   cd C:\dev\fundly
   git init
   ```

2. Buat repositori kosong di GitHub. Mulailah dengan **privat**. Jadikan publik nanti, setelah kamu memastikan riwayat commit bersih dari rahasia.

3. Buat `.gitignore` **sebelum commit pertama**. Isi minimal:

   ```
   .env
   .env.local
   .env.production
   .vercel/
   node_modules/
   dist/
   ```

4. Salin `PRD.md` dan `DESIGN.md` ke akar folder. Hasil ekspor desain dari Stitch nanti disimpan di folder `design/`.

5. Commit dan push:

   ```powershell
   git add .
   git commit -m "docs: tambah PRD dan DESIGN"
   git branch -M main
   git remote add origin <URL-repositori-GitHub-kamu>
   git push -u origin main
   ```

---

## Tahap C: Atur Claude Code sebelum coding

### C1. Sesi pertama dan CLAUDE.md

Di folder proyek jalankan `claude`. Kamu akan diminta login pada pemakaian pertama. Prompt pertama:

> Baca PRD.md dan DESIGN.md. Buat CLAUDE.md dari isi Lampiran B PRD. Jangan menulis kode dulu.

Periksa hasilnya, lalu commit.

### C2. Blokir file rahasia

Buat `.claude/settings.json`:

```json
{
  "permissions": {
    "deny": [
      "Read(./.env)",
      "Read(./.env.local)",
      "Read(./.env.production)"
    ],
    "ask": [
      "Bash(git push *)"
    ]
  }
}
```

Catatan:
- Jangan memakai pola `.env.*`, karena akan ikut memblokir `.env.example` yang memang harus bisa dibaca.
- Aturan `deny` bersifat upaya terbaik (best-effort): file rahasia tetap bisa terbaca lewat jalur lain (misalnya perintah shell yang kamu setujui). Jangan bergantung padanya saja. Pegangan utamanya: **jangan menaruh rahasia produksi di laptop**. Rahasia hanya di Environment Variables dashboard Vercel dan GitHub Secrets.

### C3. Mode kerja

- Masuk plan mode dengan `Shift+Tab` (berputar antar mode) atau awali satu prompt dengan `/plan`. Di plan mode Claude membaca dan menyusun rencana tanpa mengubah kode.
- Setelah rencana disetujui, pilih untuk mulai mengerjakan (menerima edit otomatis atau meninjau tiap edit).
- **Jangan memakai mode bypass** (`--dangerously-skip-permissions`). Itu hanya untuk lingkungan terisolasi.

---

## Tahap D: Skill Caveman

Caveman memangkas balasan Claude dengan membuang basa-basi dan penjelasan panjang, sambil menjaga fakta teknis. Pemasangan:

```powershell
npx skills add https://github.com/JuliusBrussee/caveman --skill caveman
```

Hal yang perlu diperhatikan:
- Ada beberapa mode kompresi (Lite, Full, Ultra). Untuk kamu yang sedang belajar, pakai **Lite atau Full**.
- Balasan yang terlalu ringkas bisa menyulitkan pemahaman konsep dasar. Matikan Caveman saat kamu butuh penjelasan (perintah persisnya ada di README-nya).
- Tambahkan ke `CLAUDE.md`: *"Gaya caveman hanya untuk balasan chat dan pesan commit. Kode, komentar, README, dan teks antarmuka ditulis normal."*
- Baca isi `SKILL.md` sebelum memasang, dan pastikan repositori sumbernya benar. Ada banyak fork dengan nama mirip.
- Belum jelas bagaimana hasilnya untuk balasan berbahasa Indonesia. Uji dulu beberapa balasan.

---

## Tahap E: Mulai membangun (M0 sampai M6)

Setiap tahap mengikuti alur yang sama:

1. Buat branch: `git switch -c feat/m0-fondasi`
2. Masuk plan mode, minta rencana, baca, lalu setujui.
3. Biarkan Claude Code mengerjakan satu tahap saja.
4. Jalankan tes dan baca `git diff` sebelum commit.
5. Commit, push, buka pull request. Vercel otomatis membuat **preview deployment** untuk pull request itu (link muncul di komentar PR); GitHub Actions menjalankan `ci.yml`. Setelah keduanya hijau, merge.
6. Merge ke `main` otomatis men-deploy ke produksi lewat integrasi Git Vercel.
7. Jalankan `/clear` sebelum tahap berikutnya agar konteks tidak menumpuk.
8. Perbarui `CLAUDE.md` dan `PRD.md` bila ada keputusan yang berubah.

### E1. Sesi rencana M0 (belum ada kode)

> Baca PRD.md, DESIGN.md, dan CLAUDE.md. Ringkas rencana tahap M0, sebutkan pertanyaan yang perlu kujawab, dan jangan menulis kode.

Jawab pertanyaannya, lalu setujui rencananya.

### E2. M0 bagian lokal

Pastikan Docker Desktop sudah menyala (untuk Postgres lokal saja). Lalu pakai perintah ini (sama dengan Lampiran B PRD):

> Baca PRD.md dan DESIGN.md. Kerjakan tahap M0 bagian lokal: siapkan struktur repositori (termasuk folder `api/` sebagai entry point backend Go untuk Vercel), Docker Compose dengan Postgres, migrasi goose untuk skema di bagian 8 (setiap tabel dengan RLS aktif), kerangka `api-spec/openapi.yaml` dengan endpoint bagian 9, konfigurasi sqlc, endpoint `/healthz` yang menjalankan `SELECT 1`, dan `ci.yml` dasar. Jangan mengerjakan tahap lain dan jangan menyentuh Vercel atau Supabase. Berhenti dan ringkas setelah selesai.

Setelah selesai, cek sendiri: `docker compose up` berjalan, tes lulus, backend bisa dijalankan lokal dengan `go run` dan `/healthz` menjawab.

### E3. Langkah manual di dashboard (kamu sendiri, bukan Claude Code)

1. Di Supabase: salin connection string **pooler transaction mode** (untuk aplikasi) dan **session pooler** (untuk migrasi).
2. Di Vercel: klik **Add New → Project**, hubungkan ke repositori GitHub-mu. Biarkan Vercel mendeteksi konfigurasi dari `vercel.json` setelah file itu ada di repositori.
3. Di pengaturan proyek Vercel → **Environment Variables**, isi `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` untuk Production (dan Preview bila perlu). Jangan menambahkan metode pembayaran di Billing.
4. Di GitHub → Settings → Secrets: simpan `MIGRATION_DATABASE_URL`.

### E4. M0 deploy kerangka

> Baca bagian 12 PRD.md. Tulis `vercel.json` untuk menjalankan `api/index.go` lewat Go runtime Vercel dan menyajikan `apps/web/dist` sebagai frontend, `migrate.yml` (migrasi goose lewat session pooler), dan `keepalive.yml` (ping harian ke `/api/v1/healthz`). Jangan meminta rahasia apa pun; sebutkan nama secret GitHub dan environment variable Vercel yang harus kubuat, dan langkah dashboard yang harus kulakukan sendiri. Berhenti setelah semua file siap untuk kutinjau.

Tinjau file-nya, merge ke `main`, tunggu Vercel selesai men-deploy (lihat tab Deployments di dashboard), lalu buktikan bahwa URL `*.vercel.app`-mu menjawab `/api/v1/healthz` dengan koneksi database sukses.

### E5. Tahap berikutnya

Ikuti roadmap PRD bagian 14:

| Tahap | Isi singkat |
|---|---|
| M1 | Backend inti (auth, dompet, kategori, transaksi) |
| M2 | Frontend responsif, **logo oleh Claude Code**, sistem desain (gunakan perintah logo di Lampiran B PRD; kamu memilih dari 3 konsep) |
| M3 | Laporan dan anggaran (grafik dimuat lazy) |
| M4 | PWA, offline, penanganan cold start (uji mode pesawat dan cold start) |
| M5 | Produksi dan keamanan (cek RLS, isolasi antarpengguna, kuota Vercel/Supabase) |
| M6 | Polesan portofolio (README, studi kasus, tangkapan layar) |

---

## Kebiasaan yang menjaga proyek tetap aman dan bisa kamu jelaskan

- Karena ini portofolio, baca dan minta penjelasan khusus di bagian sensitif: **auth, SQL, RLS, dan CI/CD**. Kamu harus bisa menjelaskannya sendiri saat wawancara.
- Satu tahap per sesi. Jangan menyuruh Claude Code mengerjakan Fase 2 atau 3 sebelum M5 selesai.
- Jangan pernah menempelkan password, `DATABASE_URL`, atau kredensial lain ke chat.
- Commit kecil dan sering. Kalau hasil Claude Code melenceng, kembalikan dengan `git restore` atau `git reset`, bukan menumpuk perbaikan.
- Pantau kuota gratis Vercel (bandwidth, eksekusi fungsi, CPU aktif) dan Supabase setiap akhir tahap.
- Jangan mengaktifkan pembayaran atau iklan di Fundly selama masih di paket Vercel Hobby (lihat PRD D-17); itu melanggar ketentuan layanannya.

## Pemecahan masalah singkat

| Masalah | Yang dicoba |
|---|---|
| `claude` tidak dikenali | Tutup dan buka lagi terminal; jalankan `claude --version`; ulangi pemasangan |
| Docker tidak jalan | Pastikan Docker Desktop menyala; jalankan `wsl --shutdown` lalu buka lagi; cek `.wslconfig` |
| Laptop terasa berat | Naikkan `memory` di `.wslconfig` pelan-pelan, atau tutup Docker saat tidak dipakai (`docker compose down`) |
| Deploy Vercel gagal, build Go error | Buka tab **Deployments** di dashboard Vercel, baca build log; cek apakah `go.mod` di root folder `api/` sudah benar |
| Backend jalan lokal tapi error di Vercel | Cek Environment Variables sudah terisi di dashboard (bukan hanya di `.env` lokal); cek log fungsi di dashboard Vercel |
| Cold start terasa lambat di kunjungan pertama | Normal untuk fungsi serverless yang jarang dipanggil; pastikan precache service worker (D-16) sudah berjalan |
| Supabase "paused" | Pulihkan lewat dashboard; periksa workflow `keepalive.yml` masih aktif dan menunjuk domain Vercel yang benar |
