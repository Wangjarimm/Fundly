# PRD: Fundly (pencatat keuangan pribadi, web ringan)

> Nama **Fundly** berasal dari "fund" (dana) dan akhiran "-ly" (dengan cara), yaitu mengelola dana dengan cara yang sederhana. Logo dibuat otomatis oleh Claude Code (lihat F-14 dan `DESIGN.md`).
> Dokumen ini ditulis agar bisa langsung dipakai Claude Code. Semua keputusan bertanda **[Dxx]** boleh diubah pemilik proyek; kalau diubah, perbarui bagian terkait.

- Versi: 0.5 (draf)
- Tanggal: 24 September 2026
- Perubahan v0.5: hosting backend dipindah dari **Render ke Vercel** (paket Hobby, tanpa metode pembayaran). Backend Go tetap satu proses server (bukan dipecah jadi banyak fungsi kecil), dijalankan lewat Go runtime Vercel (status Beta) di `api/index.go`, dan menyajikan frontend statis dari domain yang sama. Dockerfile untuk deploy tidak lagi dipakai (Vercel membangun langsung dari `go.mod`, bukan dari Dockerfile); Docker Compose untuk Postgres lokal tetap dipakai. Keep-alive Supabase tetap lewat GitHub Actions, sekarang menargetkan domain Vercel. Ditambah catatan penting: paket Hobby Vercel menurut ketentuan layanannya hanya untuk **pemakaian pribadi/non-komersial**; sebelum menjual produk ini, tingkatkan ke paket Pro. **Graphify dihapus dari rencana** (lihat `PANDUAN_MULAI.md`).
- Dokumen pendamping: `DESIGN.md` (sistem desain UI untuk Google Stitch dan implementasi frontend)

---

## 1. Ringkasan

Fundly adalah aplikasi web (PWA) untuk mencatat pemasukan dan pengeluaran pribadi dengan cepat, mengelompokkannya ke kategori secara otomatis, dan menampilkan laporan bulanan yang mudah dibaca. Aplikasi harus ringan sehingga tetap nyaman dipakai di HP spek rendah dan jaringan lambat.

Tagline sementara: "Kelola dana, sederhana." (boleh diganti).

Proyek ini punya dua tujuan:
1. **Produk:** aplikasi yang benar-benar berguna dan bisa dijual (model freemium) untuk semua orang.
2. **Portofolio:** menunjukkan kemampuan full-stack, Go, CI/CD, dan deployment produksi gratis (Vercel + Supabase).

**Catatan penting soal tujuan komersial.** Paket gratis Vercel (Hobby) menurut ketentuan layanannya ditujukan untuk pemakaian pribadi dan non-komersial. Untuk kebutuhan portofolio ini tidak masalah. Tapi sebelum benar-benar menjual Fundly (menerima pembayaran, memasang iklan, atau dipakai sebagai bagian dari usaha), tingkatkan ke paket Pro (berbayar). Ini dicatat sebagai keputusan D-17 dan risiko di bagian 15.

## 2. Masalah dan pengguna

**Masalah:** kebanyakan orang tidak tahu ke mana uangnya pergi setiap bulan. Aplikasi pencatat yang ada sering terlalu rumit, terlalu berat di HP lama, atau tidak cocok dengan kebiasaan pengguna Indonesia (dompet tunai, transfer bank, GoPay, OVO, DANA, ShopeePay).

**Pengguna sasaran (umum):**

| Persona | Kebutuhan utama |
|---|---|
| Mahasiswa / anak kos | Uang bulanan terbatas, ingin tahu sisa uang sampai akhir bulan |
| Pekerja kantoran | Melihat pola pengeluaran, menabung, membatasi pengeluaran tertentu |
| Pemilik usaha kecil / freelancer | Memisahkan pemasukan dan pengeluaran, laporan sederhana |
| Ibu rumah tangga / keluarga | Belanja bulanan, anggaran dapur, mudah dipakai tanpa belajar |
| Pengguna HP lama atau jaringan lambat | Aplikasi cepat terbuka dan tidak boros kuota |

## 3. Tujuan, non-tujuan, dan metrik

**Tujuan MVP**
- Mencatat satu transaksi dalam kurang dari 10 detik.
- Pengguna melihat sisa uang dan ringkasan bulan ini tanpa berpikir.
- Laporan bulanan per kategori dengan perbandingan ke bulan lalu.
- Berjalan mulus di HP kelas bawah (target uji: throttling CPU 4x, jaringan Slow 4G).
- Responsif: satu aplikasi web yang nyaman dipakai di HP, tablet, dan komputer.
- Seluruh infrastruktur berjalan di batas gratis (Vercel Hobby + Supabase Free) tanpa metode pembayaran.

**Non-tujuan (tidak dikerjakan di MVP)**
- Sinkronisasi otomatis dengan GoPay/OVO/DANA (tidak ada API resmi untuk data pribadi).
- Aplikasi Android/iOS native dan publikasi Play Store.
- Multi-mata-uang. MVP hanya rupiah (IDR).
- Fitur bank/open banking, investasi, pajak.
- Pembayaran atau langganan berbayar (dirancang tapi belum dibangun).
- Pemakaian komersial di atas paket Vercel Hobby (lihat catatan bagian 1).

**Metrik keberhasilan (uji mandiri dan pengguna awal)**

| Metrik | Target |
|---|---|
| Waktu mencatat transaksi | ≤ 10 detik, ≤ 3 ketuk |
| JavaScript awal (gzip) | ≤ 150 KB |
| Lighthouse Performance (mobile, throttled) | ≥ 90 |
| Aksesibilitas | WCAG 2.2 AA, Lighthouse Accessibility ≥ 95 |
| Responsif | Semua alur utama bisa dipakai pada lebar 360–1920 px tanpa scroll horizontal; PWA bisa dipasang di HP |
| p95 waktu respons API (invocation sudah "hangat") | < 300 ms |
| Cold start fungsi backend | Beberapa detik pada kunjungan pertama setelah idle; tidak boleh menampilkan layar kosong |
| Biaya infrastruktur bulanan | Rp 0 dalam kondisi normal |

## 4. Prinsip produk

1. **Cepat di atas segalanya.** Setiap fitur baru harus lolos anggaran performa.
2. **Sederhana untuk semua usia.** Bahasa Indonesia sehari-hari, tombol besar, tidak ada istilah keuangan yang rumit.
3. **Tidak menghakimi.** Aplikasi memberi informasi, bukan menceramahi soal pengeluaran.
4. **Data milik pengguna.** Ekspor dan hapus akun selalu tersedia.
5. **Jangan ada biaya tak terduga.** Semua keputusan infrastruktur mengutamakan kuota gratis dan tidak menyimpan metode pembayaran di platform hosting.
6. **Jujur soal keterbatasan.** Jika fungsi backend sedang "dingin" (cold start), tampilkan pesan yang jelas, jangan biarkan layar kosong.

## 5. Keputusan arsitektur dan stack

| Kode | Keputusan |
|---|---|
| D-01 | Frontend: React + Vite + TypeScript, dibangun sebagai PWA (vite-plugin-pwa). |
| D-02 | Backend: Go (router chi atau `net/http`), REST JSON di bawah `/api/v1`. Kode backend tetap satu aplikasi server dengan struktur modular (handler, service, auth, categorize), **bukan** dipecah jadi banyak fungsi kecil per file. |
| D-03 | **Satu proyek Vercel** menyajikan frontend statis (`apps/web`, hasil build Vite) **dan** backend Go, dari domain yang sama. Backend dijalankan sebagai satu proses server lewat Go runtime Vercel (lihat D-09), dipetakan ke path `/api/*` lewat `vercel.json`. Karena satu origin, cookie sesi tetap sederhana (tidak perlu CORS lintas domain). |
| D-04 | Database produksi: **Supabase** (PostgreSQL), dipakai **hanya sebagai database**. Supabase Auth, Storage, Realtime, dan Edge Functions tidak dipakai. Region Singapore. Paket gratis (per informasi Mei–Juli 2026, cek ulang sebelum deploy): 2 proyek aktif, 500 MB database per proyek, proyek dijeda setelah 7 hari tanpa aktivitas. |
| D-05 | Akses DB: pgx + sqlc. Migrasi: goose. |
| D-06 | Kontrak API: OpenAPI 3.1 di `api-spec/openapi.yaml` (nama folder sengaja bukan `api/` agar tidak bentrok dengan folder fungsi Vercel, lihat D-09). Tipe Go dari oapi-codegen, tipe TypeScript dari openapi-typescript. |
| D-07 | Auth: email + password (argon2id) dan Google OAuth. Sesi berbasis cookie HttpOnly, disimpan di tabel `sessions`. |
| D-08 | Uang disimpan sebagai `BIGINT` rupiah (tanpa desimal). |
| D-09 | **Hosting: Vercel (paket Hobby, gratis, tanpa metode pembayaran).** Backend Go dijalankan lewat **Go runtime Vercel (status Beta per Januari 2026)** dalam mode "server": satu entry point (`api/index.go`, atau `api/cmd/server/main.go` sesuai konvensi Vercel) yang membaca port dari variabel lingkungan `PORT` dan menjalankan seluruh router chi seperti aplikasi Go biasa, bukan dipecah per file per endpoint. Karena statusnya Beta, verifikasi ulang perilakunya (durasi maksimum, dukungan region, dukungan modul internal) di dokumentasi Vercel terbaru sebelum implementasi. |
| D-10 | **CI/CD:** Vercel terhubung langsung ke repositori GitHub lewat integrasinya sendiri — setiap push ke `main` otomatis build dan deploy ke produksi, setiap pull request mendapat *preview deployment* dengan URL sendiri. `vercel.json` menyimpan konfigurasi build dan routing. GitHub Actions dipakai untuk hal yang tidak dilakukan Vercel: lint, tes (`ci.yml`), dan menjalankan migrasi database (`migrate.yml`). Tidak ada Deploy Hook manual karena Vercel sudah men-deploy sendiri dari Git. Terraform tidak dipakai (tidak relevan untuk Vercel). |
| D-11 | OCR struk (Fase 2): **tidak dijalankan di fungsi backend Vercel Hobby** (durasi maksimum tiap eksekusi terbatas beberapa puluh detik dan CPU aktif bulanan terbatas 4 jam, verifikasi angka pastinya di dashboard). Pilihan: API vision eksternal (berbiaya per pemakaian, harus opsional) atau Tesseract.js di browser yang dimuat lazy dan hanya jika lolos anggaran performa. Diputuskan di Fase 2. |
| D-12 | **RLS wajib.** Supabase membuka tabel di skema `public` lewat Data API dengan kunci publik. Setiap tabel aplikasi harus `ENABLE ROW LEVEL SECURITY` (tanpa policy = akses lewat Data API ditolak) dalam migrasi yang sama dengan pembuatan tabelnya. Kunci Supabase (anon/service) tidak pernah dipakai di frontend maupun backend. Backend hanya memakai koneksi database langsung ke Postgres. |
| D-13 | **Koneksi ke Supabase dari fungsi Vercel.** Karena backend berjalan sebagai fungsi serverless (bisa ada banyak *invocation* berjalan bersamaan, masing-masing dengan koneksinya sendiri), wajib memakai connection string **pooler mode transaction** dari dashboard Supabase, dengan ukuran pool pgx yang sangat kecil (mis. 1–3 koneksi) per instance fungsi, dan pgx diatur tanpa *prepared statement cache* (sesuai batasan transaction pooler / pgbouncer). Simpan koneksi sebagai variabel level-paket agar dipakai ulang saat *invocation* "hangat" (warm), bukan dibuka ulang tiap request. **Migrasi goose dijalankan dari GitHub Actions** (bukan dari fungsi Vercel) lewat *session pooler*, bukan transaction pooler. Verifikasi detailnya dengan dokumentasi Supabase terbaru saat implementasi. |
| D-14 | **Pengembangan lokal memakai Postgres di Docker Compose** (Docker Desktop, di Windows lewat WSL2; lihat catatan `.wslconfig` di bagian 12). Backend Go dijalankan langsung dengan `go run` untuk pengembangan sehari-hari (bukan lewat Vercel), tersambung ke Postgres lokal. `vercel dev` boleh dipakai sesekali untuk menguji routing persis seperti produksi, tapi bukan alur kerja utama. Supabase dan Vercel tidak disentuh saat coding sehari-hari. Skema di Postgres lokal dan Supabase harus identik lewat migrasi goose yang sama. Satu proyek Supabase kedua boleh dipakai sebagai staging. |
| D-15 | **Keep-alive Supabase: DIPAKAI.** Workflow GitHub Actions terjadwal (sekali sehari) memanggil `GET https://<domain-vercel>/api/v1/healthz`; handler menjalankan `SELECT 1` ke database. Dikonfirmasi pemilik proyek: Supabase menghitung `SELECT 1` sebagai aktivitas. Catatan: GitHub dapat menonaktifkan workflow terjadwal di repositori yang tidak ada aktivitasnya selama sekitar 60 hari (verifikasi di dokumentasi GitHub); pantau dan aktifkan ulang bila perlu. |
| D-16 | **Penanganan cold start (versi Vercel).** Fungsi Vercel yang jarang dipanggil bisa mengalami *cold start* beberapa detik (jauh lebih singkat daripada kontainer yang tidur penuh), tapi tetap harus ditangani dengan sopan: (a) service worker menyimpan cangkang aplikasi (precache) sehingga kunjungan ulang tampil instan; (b) klien API memakai timeout yang wajar (mis. 15–20 detik) dan retry dengan backoff untuk permintaan pertama; (c) tampilkan skeleton dan pesan singkat ("Menyambungkan…") jika respons lebih dari sekitar 2 detik; (d) tulis transaksi saat server belum siap masuk antrean lokal (idempoten, lihat F-07). |
| D-17 | **Tidak menambahkan metode pembayaran ke Vercel.** Tanpa kartu, tidak ada risiko tagihan sama sekali. Konsekuensinya: kalau kuota Hobby (bandwidth, jumlah eksekusi, CPU aktif) terlampaui, fitur tertentu bisa berhenti sampai periode berikutnya (bukan ditagih). **Pemakaian komersial melanggar ketentuan layanan paket Hobby**; sebelum menjual Fundly, tingkatkan ke paket Pro (berbayar) terlebih dulu. Pantau pemakaian di dashboard Vercel. |
| D-18 | **Responsif, satu basis kode.** Satu PWA untuk semua perangkat (tanpa situs terpisah untuk HP). Pendekatan mobile-first dengan breakpoint Tailwind bawaan: dasar (< 640 px, HP), `sm` 640, `md` 768 (tablet), `lg` 1024 (laptop, sidebar), `xl` 1280 (desktop, lebar konten maksimal 1120 px). Perilaku lengkap per breakpoint ada di `DESIGN.md` (bagian Layout). |
| D-19 | **Logo dibuat oleh Claude Code sebagai SVG**, dari brief di `DESIGN.md` (bagian "Logo dan identitas"). Claude Code menyiapkan 3 konsep, pemilik proyek memilih dan meminta revisi. Aset disimpan di `apps/web/public/brand/` dan `apps/web/public/icons/`. Ikon PWA dan favicon diturunkan dari satu SVG sumber lewat skrip (mis. `@vite-pwa/assets-generator` atau skrip Node dengan sharp/resvg; verifikasi alat yang tersedia), hanya sebagai devDependency sehingga tidak masuk bundel. |

**Stack frontend:** Tailwind CSS + shadcn/ui, TanStack Query, Zod (validasi form), Recharts (di-lazy-load hanya di halaman laporan), Vitest, Playwright.
**Stack backend:** Go, chi, pgx, sqlc, goose, go-playground/validator, oapi-codegen, `go test`.
**Infra:** Docker (hanya untuk Postgres lokal, bukan untuk deploy), Vercel (Hobby), Supabase (Postgres), `vercel.json`, GitHub Actions.

### Struktur repositori

```
fundly/
├── apps/
│   └── web/                 (React + Vite + PWA)
│       └── public/
│           ├── brand/       (logo SVG)
│           └── icons/       (favicon, ikon PWA)
├── api/                     (service Go di Vercel Services: backend Go, satu entry point)
│   ├── go.mod
│   ├── cmd/server/main.go   (entry point: baca PORT, jalankan router chi)
│   ├── cmd/migrate/main.go  (migrasi goose, dipanggil dari GitHub Actions)
│   └── internal/
│       ├── http/            (handler, middleware)
│       ├── service/         (logika bisnis)
│       ├── auth/
│       ├── categorize/      (kategori otomatis)
│       └── db/
│           ├── migrations/  (goose)
│           ├── queries/     (SQL untuk sqlc)
│           └── sqlc.yaml
├── api-spec/
│   └── openapi.yaml
├── docker-compose.yml       (Postgres lokal untuk pengembangan)
├── vercel.json              (build, routing /api/*, region jika didukung)
├── .github/workflows/
│   ├── ci.yml               (lint, tes, build, cek bundel)
│   ├── migrate.yml          (jalankan goose lewat session pooler saat push ke main)
│   └── keepalive.yml        (ping harian ke /api/v1/healthz)
├── PRD.md
├── DESIGN.md
├── CLAUDE.md
└── .env.example
```

Catatan: folder backend memakai nama `api/` karena itu adalah konvensi yang dibaca Vercel untuk fungsi/serverless entry point. Spesifikasi OpenAPI dipindah ke `api-spec/` agar tidak tertukar secara nama dengan folder tersebut.

## 6. Kebutuhan fungsional

Setiap fitur punya kode (F-xx), user story, dan kriteria penerimaan (KP). Fitur ditandai **MVP**, **Fase 2**, atau **Fase 3**.

### F-01 Akun dan login (MVP)
Sebagai pengguna, saya ingin masuk dengan email atau akun Google agar data saya tersimpan aman.
- KP1: Daftar dengan email + password (minimal 8 karakter). Password di-hash dengan argon2id.
- KP2: Masuk dengan Google OAuth.
- KP3: Sesi memakai cookie `HttpOnly`, `Secure`, `SameSite=Lax`. Kedaluwarsa 30 hari dengan perpanjangan saat aktif.
- KP4: Logout menghapus sesi di server.
- KP5: Hapus akun menghapus semua data pengguna secara permanen setelah konfirmasi.
- KP6: Pembatasan laju (rate limit) pada endpoint login dan daftar.

### F-02 Dompet (MVP)
Sebagai pengguna, saya ingin punya beberapa dompet (tunai, bank, e-wallet) agar tahu uang saya ada di mana.
- KP1: Buat, ubah, arsipkan dompet. Jenis: `cash`, `bank`, `ewallet`, `other`.
- KP2: Dompet e-wallet boleh punya label penyedia (GoPay, OVO, DANA, ShopeePay, dll.) sebagai teks bebas atau pilihan preset. Tidak ada sinkronisasi otomatis.
- KP3: Setiap dompet punya saldo awal. Saldo sekarang dihitung dari saldo awal + pemasukan − pengeluaran.
- KP4: Saat pertama kali masuk, aplikasi membuat satu dompet "Tunai" otomatis.

### F-03 Catat transaksi (MVP)
Sebagai pengguna, saya ingin mencatat pengeluaran atau pemasukan dengan sangat cepat.
- KP1: Form minimal: jenis (pengeluaran/pemasukan), jumlah, dompet, tanggal (default hari ini). Kategori, nama toko/merchant, dan catatan opsional.
- KP2: Keypad angka besar dengan pemisah ribuan otomatis (format `Rp 87.500`).
- KP3: Dompet terakhir dipakai menjadi default.
- KP4: Lihat daftar transaksi per bulan, dikelompokkan per hari, dengan pencarian dan filter (dompet, kategori, jenis).
- KP5: Ubah dan hapus transaksi (hapus bisa dibatalkan selama beberapa detik lewat toast "Batalkan").
- KP6: Bisa dipakai saat offline atau saat backend belum "hangat"; transaksi tersimpan lokal lalu disinkronkan (lihat F-07).

### F-04 Kategori dan kategori otomatis (MVP)
Sebagai pengguna, saya ingin transaksi masuk kategori yang benar tanpa memilih manual.
- KP1: Sediakan kategori bawaan (lihat lampiran A). Pengguna boleh menambah, mengubah, menyembunyikan kategori.
- KP2: Saat pengguna mengetik nama merchant/catatan, aplikasi menyarankan kategori berdasarkan aturan kata kunci (endpoint `POST /categories/suggest`).
- KP3: Jika pengguna mengoreksi kategori, aplikasi menyimpan aturan pribadi `kata kunci → kategori` dan memakainya lain kali (prioritas lebih tinggi dari aturan bawaan).
- KP4: Saran tampil sebagai chip yang bisa diketuk; tidak pernah memaksa.
- KP5: Pencocokan tidak sensitif huruf besar/kecil dan mengabaikan tanda baca.

### F-05 Laporan bulanan (MVP)
Sebagai pengguna, saya ingin melihat ringkasan bulan ini agar tahu kondisi keuangan saya.
- KP1: Menampilkan total pemasukan, total pengeluaran, selisih, dan rata-rata pengeluaran harian.
- KP2: Rincian pengeluaran per kategori (persentase dan jumlah), diurutkan terbesar.
- KP3: Perbandingan dengan bulan sebelumnya (persentase naik/turun) dengan kata-kata netral.
- KP4: Tren harian atau mingguan dalam bulan (grafik garis/batang). Grafik di-lazy-load.
- KP5: Pindah bulan dengan panah kiri/kanan. Bulan tanpa data menampilkan keadaan kosong yang mengajak mencatat.
- KP6: Ekspor transaksi bulan terpilih ke CSV.

### F-06 Anggaran per kategori (MVP)
Sebagai pengguna, saya ingin batas pengeluaran per kategori agar tidak boros.
- KP1: Atur batas bulanan per kategori pengeluaran.
- KP2: Tampilkan progres (terpakai/batas). Status: aman, hampir habis (≥ 80%), terlampaui (≥ 100%). Status tidak hanya dibedakan lewat warna (ikon dan teks juga).
- KP3: Anggaran bulan baru otomatis menyalin bulan lalu (bisa dimatikan).

### F-07 PWA, offline, dan cold start (MVP)
- KP1: Bisa dipasang ke layar utama (manifest dan ikon lengkap).
- KP2: Cangkang aplikasi (shell) dan aset statis di-cache oleh service worker (precache), sehingga kunjungan ulang tampil instan walau fungsi backend sedang "dingin".
- KP3: Data terakhir dilihat tetap bisa dibuka saat offline (baca saja).
- KP4: Transaksi baru saat offline atau backend belum siap masuk antrean lokal (IndexedDB), lalu dikirim saat siap dengan kunci idempoten (`client_id` UUID) agar tidak ganda.
- KP5: Indikator kecil "Offline", "Menyambungkan…", dan "Menyinkronkan" tanpa mengganggu.
- KP6: Permintaan API pertama memakai timeout wajar (≈ 15–20 detik) dan retry dengan backoff (lihat D-16). Jika lebih dari sekitar 2 detik tanpa respons, tampilkan indikator "Menyambungkan…".
- KP7: Halaman error yang jelas jika backend atau database benar-benar tidak tersedia, dengan tombol "Coba lagi".

### F-08 Pengaturan dan privasi (MVP)
- KP1: Ubah nama, ganti password, mode tampilan (terang/gelap/ikuti sistem).
- KP2: Ekspor semua data (CSV atau JSON) dan hapus akun.
- KP3: Halaman kebijakan privasi sederhana dalam Bahasa Indonesia.

### F-09 Foto struk (Fase 2)
- Ambil foto struk dari kamera browser, kompres di klien (sisi lebar maksimum sekitar 1280 px), unggah, baca total dan nama toko lewat OCR, isi form otomatis untuk dikonfirmasi pengguna.
- Lokasi OCR mengikuti D-11 (tidak di fungsi backend Vercel Hobby). Fitur tidak boleh menambah bundel awal. Modul dimuat hanya saat tombol ditekan.
- Foto struk tidak disimpan permanen kecuali pengguna memilih; secara default dihapus setelah diproses.

### F-10 Patungan / split bill (Fase 2)
- Buat tagihan, tambahkan teman (nama saja, tanpa akun), bagi rata atau per item, tandai sudah bayar, buat teks ringkasan untuk dibagikan lewat WhatsApp.

### F-11 Impor mutasi dan screenshot e-wallet (Fase 3)
- Impor CSV mutasi bank dan bukti transaksi (screenshot) lewat OCR. Semua tetap dikonfirmasi pengguna sebelum disimpan.

### F-12 Premium (Fase 3, opsional)
- Paket berbayar untuk foto struk tanpa batas, patungan, ekspor lanjutan. Model freemium. Integrasi pembayaran tidak dikerjakan di MVP. **Prasyarat:** hosting sudah dipindah dari Vercel Hobby ke Pro (lihat D-17) sebelum fitur ini dipakai secara komersial.

### F-13 Tampilan responsif (MVP)
Sebagai pengguna, saya ingin aplikasi nyaman dipakai di HP, tablet, maupun komputer.
- KP1: Semua layar MVP bisa dipakai pada lebar 360–1920 px. Tidak ada scroll horizontal pada halaman (tabel atau grafik lebar boleh scroll di dalam wadahnya sendiri).
- KP2: HP (< 768 px): satu kolom, navigasi bawah 5 item, form transaksi sebagai bottom sheet. Tablet (768–1023 px): rail navigasi di kiri, beranda dan laporan dua kolom bila cukup, form sebagai dialog di tengah. Laptop/desktop (≥ 1024 px): sidebar penuh, beranda dua kolom, lebar konten maksimal 1120 px.
- KP3: Mendukung sentuh, mouse, dan keyboard: target sentuh ≥ 48 px, fokus keyboard terlihat, tidak ada aksi yang hanya bisa lewat hover, keypad angka juga menerima ketikan keyboard (`inputmode="numeric"`).
- KP4: Mendukung portrait dan landscape, safe-area (notch, home indicator) lewat `viewport-fit=cover` dan `env(safe-area-inset-*)`, serta tinggi layar dinamis (`dvh`) agar bilah alamat browser HP tidak memotong tombol.
- KP5: Tata letak tetap rapi pada pembesaran teks 200% dan zoom browser.
- KP6: PWA dapat dipasang di Android (Chrome) dan ditambahkan ke layar utama di iOS (Safari), dengan ikon yang benar (F-14).
- KP7: Diuji otomatis (Playwright) pada viewport 360×800, 390×844, 768×1024, 1366×768, dan 1920×1080.

### F-14 Identitas merek dan logo (MVP)
Sebagai pemilik proyek, saya ingin logo Fundly dibuat otomatis oleh Claude Code agar produk punya identitas visual sejak awal.
- KP1: Claude Code membuat 3 konsep logo dalam SVG sesuai brief di `DESIGN.md` (bagian "Logo dan identitas") dan menampilkannya berdampingan di satu halaman pratinjau lokal. Pemilik proyek memilih satu dan meminta revisi sampai puas.
- KP2: Hasil akhir: logo mark (ikon), wordmark "Fundly", logo horizontal (ikon + tulisan), serta versi satu warna untuk latar terang dan gelap.
- KP3: Aset turunan: favicon (SVG dan .ico), ikon PWA 192 dan 512 px (termasuk versi maskable), apple-touch-icon 180 px, dan gambar pratinjau berbagi (OG image, opsional).
- KP4: Logo mark tetap terbaca pada 16 px dan dalam satu warna. SVG bersih (tanpa gambar raster tertanam) dan kecil (target < 3 KB untuk logo mark).
- KP5: Semua file berada di `apps/web/public/brand/` dan `apps/web/public/icons/`; manifest PWA dan tag `<head>` menunjuk ke sana.
- KP6: Logo dipakai di halaman masuk, header/sidebar, dan halaman "Tentang" tanpa menambah bundel JS awal secara berarti.
- KP7: Sebelum rilis komersial, pemilik proyek memeriksa ketersediaan nama dan kemiripan nama/logo dengan merek lain.

## 7. Kebutuhan non-fungsional

**Performa**
- Anggaran bundel: JS awal ≤ 150 KB gzip. Pecah kode per rute. Recharts dan modul OCR hanya dimuat saat dibutuhkan.
- Tanpa font web yang berat: pakai satu keluarga font dengan subset Latin dan `font-display: swap`, dengan cadangan font sistem (lihat `DESIGN.md`).
- Tanpa gambar dekoratif besar. Ikon berupa SVG inline atau sprite kecil.
- Daftar panjang memakai paginasi berbasis kursor (bukan offset). Virtualisasi hanya jika terbukti perlu.
- Fungsi backend Vercel Hobby punya batas CPU aktif bulanan (sekitar 4 jam) dan durasi maksimum per eksekusi: jangan menjalankan pekerjaan berat di server (OCR, pembuatan laporan besar). Hitung agregat di SQL, bukan di memori aplikasi.
- Uji rutin dengan CPU throttling 4x dan Slow 4G.

**Responsif dan lintas perangkat**
- Mobile-first: gaya dasar untuk HP, lalu ditambah untuk layar lebih besar (lihat D-18).
- Tata letak memakai flex/grid dan unit relatif (`rem`, `%`, `clamp()`). Grafik memakai SVG dengan `viewBox` agar skalanya otomatis. Di HP, daftar berbentuk baris, bukan tabel lebar.
- Satu basis kode untuk semua perangkat; tidak ada situs terpisah untuk HP.
- Browser sasaran: Chrome (Android dan desktop), Safari (iOS dan macOS), Edge, dan Firefox versi terbaru.
- Matriks uji viewport ada di F-13 KP7 dan strategi pengujian (bagian 13).

**Aksesibilitas (WCAG 2.2 AA)**
- Kontras teks ≥ 4,5:1, target sentuh ≥ 48 px, fokus keyboard terlihat, dukung pembesaran teks sampai 200%.
- Tidak mengandalkan warna saja untuk arti (pemasukan/pengeluaran punya tanda +/− dan ikon).
- Semua kontrol punya label untuk pembaca layar. Hormati `prefers-reduced-motion`.

**Keamanan dan privasi**
- Semua query lewat sqlc (parameter terikat). Validasi input di server untuk setiap endpoint.
- Cookie sesi `HttpOnly`, `Secure`, `SameSite=Lax`; permintaan yang mengubah data wajib membawa header khusus (mis. `X-Requested-With`) sebagai lapisan CSRF tambahan.
- Header keamanan: CSP ketat, `X-Content-Type-Options`, `Referrer-Policy`, HSTS.
- Rate limiting di login/daftar/endpoint saran kategori. `/healthz` hanya mengembalikan status minimal dan juga dibatasi lajunya.
- Setiap query data selalu dibatasi `user_id` sesi (uji khusus untuk mencegah kebocoran antarpengguna).
- RLS aktif di semua tabel (lihat D-12) dan diuji: permintaan ke Data API Supabase memakai kunci publik harus tidak mengembalikan data apa pun.
- Rahasia (URL database, kunci OAuth) hanya di **Environment Variables** proyek Vercel dan GitHub Secrets, tidak pernah di repositori, tidak pernah ditempel ke chat dengan asisten AI, dan tidak pernah dicetak ke log.
- File `.env` masuk `.gitignore`; sediakan `.env.example` tanpa nilai rahasia.
- Data keuangan adalah data pribadi. Sediakan ekspor dan hapus akun, minimalkan data yang dikumpulkan, dan tulis kebijakan privasi. (Pemilik proyek perlu memeriksa kewajiban hukum yang berlaku, termasuk UU Pelindungan Data Pribadi, sebelum rilis komersial.)

**Keandalan dan observabilitas**
- Endpoint `/healthz` (mengecek koneksi database dengan `SELECT 1`). Log terstruktur (JSON), dapat dilihat di dashboard Vercel (Logs/Observability). Penanganan error konsisten dengan format `{ "error": { "code", "message" } }`.
- Backend harus **stateless** (tidak menulis ke disk lokal, sesi di database) karena setiap *invocation* fungsi bisa berjalan di instance yang berbeda.
- Paket gratis Supabase menjeda proyek setelah 7 hari tanpa aktivitas. Mitigasi: keep-alive harian (D-15) dan halaman status sederhana di aplikasi saat database tidak bisa dihubungi.
- Cadangan otomatis harian umumnya tidak termasuk paket gratis Supabase (verifikasi di dokumentasi). Sebagai gantinya, sediakan skrip ekspor (`pg_dump`) yang bisa dijalankan manual atau terjadwal lewat GitHub Actions ke penyimpanan gratis, dan pertahankan fitur ekspor data per pengguna.

**Biaya**
- Tidak ada metode pembayaran di Vercel (D-17). Karena tanpa kartu, tidak ada risiko tagihan sama sekali; risikonya hanya fitur berhenti sementara jika kuota Hobby terlampaui.
- Pantau bandwidth, jumlah eksekusi fungsi, dan CPU aktif di dashboard Vercel, serta pemakaian Supabase, setiap akhir tahap.
- Ingat batasan non-komersial paket Hobby (D-17) sebelum memasang metode monetisasi apa pun.

## 8. Model data (draf)

Semua tabel memakai `id UUID` (kecuali disebut lain), `created_at TIMESTAMPTZ`. Uang dalam `BIGINT` rupiah. Tanggal transaksi berupa `DATE` (tanggal lokal pengguna, zona Asia/Jakarta sebagai default).

```sql
users(
  id, email CITEXT UNIQUE, password_hash TEXT NULL, google_sub TEXT UNIQUE NULL,
  display_name TEXT, theme TEXT DEFAULT 'system', created_at
)

sessions(
  id, user_id → users, token_hash TEXT UNIQUE, expires_at, last_seen_at, created_at
)

wallets(
  id, user_id → users, name TEXT, type TEXT CHECK (type IN ('cash','bank','ewallet','other')),
  provider TEXT NULL, initial_balance BIGINT DEFAULT 0, archived_at NULL, created_at
)

categories(
  id, user_id → users NULL,          -- NULL = kategori bawaan sistem
  name TEXT, kind TEXT CHECK (kind IN ('expense','income')),
  icon TEXT, color_token TEXT, sort_order INT, hidden BOOL DEFAULT false, created_at
)

transactions(
  id, user_id → users, wallet_id → wallets, category_id → categories NULL,
  kind TEXT CHECK (kind IN ('expense','income')),
  amount BIGINT CHECK (amount > 0),
  occurred_on DATE, merchant TEXT NULL, note TEXT NULL,
  source TEXT DEFAULT 'manual',      -- manual | receipt | import
  client_id UUID NULL,               -- kunci idempoten dari klien
  created_at, updated_at, deleted_at NULL,
  UNIQUE (user_id, client_id)
)

budgets(
  id, user_id → users, category_id → categories, month DATE,   -- tanggal 1 bulan tsb
  limit_amount BIGINT CHECK (limit_amount >= 0),
  UNIQUE (user_id, category_id, month)
)

category_rules(
  id, user_id → users NULL,          -- NULL = aturan bawaan
  keyword TEXT, category_id → categories, priority INT DEFAULT 0, created_at
)

user_category_settings(              -- ditambahkan di M1
  user_id → users, category_id → categories, hidden BOOL, sort_order INT NULL,
  PRIMARY KEY (user_id, category_id)
)
```

Catatan M1: kategori bawaan (`user_id NULL`) dipakai bersama semua pengguna, sehingga "sembunyikan" dan urutan kategori bawaan disimpan per pengguna di `user_category_settings`; kolom `categories.hidden` hanya dipakai untuk kategori milik pengguna. Kategori bawaan tidak bisa diganti nama (403); pengguna membuat kategori sendiri bila perlu nama lain. Saat akun email yang sudah ada ditautkan ke Google, password lamanya dihapus karena email tidak diverifikasi saat daftar (mencegah pengambilalihan akun oleh orang yang mendaftar lebih dulu dengan email korban); pengguna bisa membuat password baru lewat Pengaturan.

Indeks penting: `transactions(user_id, occurred_on DESC)`, `transactions(user_id, category_id, occurred_on)`, `transactions(user_id, wallet_id)`.

Catatan: transfer antar dompet ditunda ke Fase 2. Di MVP, saldo dompet dihitung dari transaksi.

**Keamanan tabel (Supabase):** setiap migrasi yang membuat tabel wajib diikuti `ALTER TABLE <nama> ENABLE ROW LEVEL SECURITY;` tanpa membuat policy (D-12). Tambahkan tes otomatis yang gagal jika ada tabel di skema `public` tanpa RLS. Migrasi harus berjalan sama di Postgres lokal dan Supabase (D-14); hindari ekstensi atau fitur yang hanya ada di salah satunya.

Tabel Fase 2 (dirancang, belum dibuat): `split_bills`, `split_participants`, `split_items`, `receipt_scans`.

## 9. Kontrak API (draf, dijadikan `api-spec/openapi.yaml`)

Semua endpoint di bawah `/api/v1`, JSON, dan butuh sesi kecuali disebut lain.

| Metode | Path | Fungsi |
|---|---|---|
| POST | `/auth/register` | Daftar (publik) |
| POST | `/auth/login` | Masuk (publik) |
| POST | `/auth/logout` | Keluar |
| GET | `/auth/google` | Mulai OAuth Google (publik) |
| GET | `/auth/google/callback` | Callback OAuth (publik) |
| GET | `/me` | Profil dan pengaturan |
| PATCH | `/me` | Ubah profil/tema/password |
| DELETE | `/me` | Hapus akun dan semua data |
| GET | `/wallets` | Daftar dompet beserta saldo sekarang |
| POST | `/wallets` | Buat dompet |
| PATCH | `/wallets/{id}` | Ubah/arsipkan dompet |
| GET | `/categories` | Daftar kategori (bawaan + milik pengguna) |
| POST | `/categories` | Buat kategori |
| PATCH | `/categories/{id}` | Ubah/sembunyikan kategori |
| POST | `/categories/suggest` | Body `{merchant, note}` → `{category_id, confidence}` |
| GET | `/transactions` | Query: `month`, `wallet_id`, `category_id`, `kind`, `q`, `cursor`, `limit` |
| POST | `/transactions` | Buat transaksi (mendukung `client_id`) |
| GET | `/transactions/{id}` | Detail |
| PATCH | `/transactions/{id}` | Ubah |
| DELETE | `/transactions/{id}` | Hapus (soft delete) |
| POST | `/transactions/{id}/restore` | Batalkan hapus |
| GET | `/reports/monthly` | Query `month=YYYY-MM` → total, per kategori, banding bulan lalu, seri harian |
| GET | `/budgets` | Query `month` → anggaran + terpakai |
| PUT | `/budgets/{category_id}` | Query `month`; atur batas |
| GET | `/export/transactions.csv` | Ekspor CSV |
| GET | `/healthz` | Cek kesehatan + `SELECT 1` ke database (publik) |

Aturan umum: validasi ketat, kode status benar (400/401/403/404/409/422/429), pagination kursor, respons error seragam, dan setiap query dibatasi `user_id` sesi.

Fase 2: `POST /receipts/scan`, `/splits` (CRUD tagihan patungan).

## 10. Kategori otomatis (aturan)

1. Normalisasi teks: huruf kecil, hapus tanda baca, rapikan spasi.
2. Cocokkan dengan `category_rules` milik pengguna dulu (prioritas tertinggi), lalu aturan bawaan.
3. Pencocokan berdasarkan kata utuh atau awalan kata. Jika beberapa cocok, pilih yang prioritasnya tertinggi, lalu kata kunci terpanjang.
4. Kembalikan `category_id` dan `confidence` sederhana (mis. 1.0 untuk aturan pengguna, 0.8 untuk aturan bawaan). Tanpa kecocokan, kembalikan `null`.
5. Pengguna mengoreksi → buat/perbarui aturan pribadi.
6. AI/LLM untuk saran kategori adalah peningkatan Fase 2 dan harus opsional serta berbiaya terkendali.

Contoh aturan bawaan (isi awal, boleh diperluas):
`indomaret, alfamart, supermarket → Belanja` · `gojek, grab, ojek, bensin, parkir, tol → Transport` · `kopi, warung, makan, resto, gofood, grabfood → Makanan` · `listrik, pln, pdam, internet, wifi, pulsa → Tagihan` · `gaji, honor, bonus → Gaji (pemasukan)`.

## 11. Layar dan alur

Rincian visual ada di `DESIGN.md`. Daftar layar MVP:

1. Masuk / daftar
2. Beranda: sisa uang, ringkasan bulan, transaksi terbaru, tombol tambah
3. Tambah/ubah transaksi (bottom sheet di HP, dialog di layar lebih besar)
4. Daftar transaksi (pencarian dan filter)
5. Laporan bulanan
6. Anggaran
7. Dompet (daftar dan ubah)
8. Kategori (daftar dan ubah)
9. Pengaturan (profil, tema, ekspor, hapus akun, privasi)
10. Keadaan kosong, error, offline, dan "menyambungkan…" untuk tiap layar utama

Navigasi bawah (mobile): Beranda, Transaksi, Tambah (tombol utama), Laporan, Lainnya. Di layar lebar, navigasi bawah menjadi sidebar.

## 12. Deployment dan CI/CD (Vercel + Supabase)

**Lingkungan:** `dev` (lokal, Docker Compose dengan Postgres, backend dijalankan langsung dengan `go run`), `prod` (proyek Vercel + proyek Supabase produksi, deploy otomatis dari `main`), dan `staging` opsional (setiap pull request otomatis dapat *preview deployment* dari Vercel; database staging bisa memakai proyek Supabase gratis kedua). Pengembangan harian selalu di `dev`; Vercel dan Supabase tidak disentuh saat coding sehari-hari.

**Catatan pengembangan lokal di Windows (Docker Desktop + WSL2):** Docker Desktop di Windows berjalan di atas mesin virtual WSL2 yang secara default boleh memakai memori dalam jumlah besar. Batasi lewat file `C:\Users\<nama>\.wslconfig`, sesuaikan angkanya dengan RAM laptop (contoh hemat, untuk laptop 16 GB yang hanya menjalankan satu container Postgres):

```ini
[wsl2]
memory=2GB
processors=2
swap=1GB
```

Terapkan dengan menjalankan `wsl --shutdown` di PowerShell, lalu buka kembali Docker Desktop. Jika versi WSL mendukung, opsi `autoMemoryReclaim=gradual` di bagian `[experimental]` membantu mengembalikan memori yang tidak terpakai (verifikasi di dokumentasi WSL). Hentikan container saat tidak coding (`docker compose down`) dan jalankan `docker system prune` sesekali untuk membersihkan sisa image. Untuk proyek ini cukup satu container Postgres.

**Fakta Vercel Hobby yang memengaruhi desain** (dari beberapa sumber per September 2026; angka-angka berikut dilaporkan berbeda-beda antar sumber, jadi **verifikasi ulang di dashboard proyekmu sebelum deploy**):
- Tidak perlu kartu untuk paket Hobby, dan paketnya gratis tanpa batas waktu.
- **Fungsi backend Go memakai Go runtime berstatus Beta.** Bisa ditulis sebagai satu proses server (membaca `PORT` dari environment) atau sebagai fungsi per file di `/api`; PRD ini memilih mode satu proses server (D-09) agar strukturnya tetap mirip aplikasi Go biasa.
- Batas kuota bulanan yang sering disebut: sekitar 100 GB bandwidth, sekitar 1 juta eksekusi fungsi, sekitar 4 jam CPU aktif, dan durasi maksimum tiap eksekusi fungsi (angka yang dilaporkan berbeda-beda, dari puluhan detik sampai beberapa menit tergantung sumber dan tanggal artikel). **Cek nilai pasti untuk paket dan tanggal saat ini di dashboard Vercel.**
- Menurut ketentuan layanannya, paket Hobby untuk pemakaian **pribadi dan non-komersial**. Pemakaian komersial memerlukan paket Pro berbayar.
- Ada laporan yang saling bertentangan soal apakah pemakaian yang melebihi kuota otomatis dihentikan sampai periode berikutnya, atau berpotensi memunculkan tagihan bila fitur tertentu diaktifkan. **Karena tidak ada metode pembayaran tersimpan (D-17), tidak ada tagihan yang bisa ditarik**; risiko yang nyata hanyalah fitur berhenti sementara. Tetap disarankan memantau dashboard secara berkala.
- Tidak ada disk persisten dan tidak ada shell/SSH ke fungsi yang berjalan; migrasi database karena itu dijalankan dari GitHub Actions, bukan dari Vercel.

**Konfigurasi build (`vercel.json`, sketsa; verifikasi field terhadap dokumentasi terbaru):**

```json
{
  "buildCommand": "cd apps/web && npm install && npm run build",
  "outputDirectory": "apps/web/dist",
  "functions": {
    "api/index.go": {
      "runtime": "@vercel/go"
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.go" }
  ]
}
```

Nama field, cara menunjuk runtime Go, dan dukungan opsi `regions` pada paket Hobby perlu dicocokkan dengan dokumentasi Vercel terbaru (statusnya Beta dan bisa berubah).

**Hasil verifikasi (M0, 25 September 2026, dokumentasi Vercel per Agustus 2026):** Go runtime mode server mendeteksi `go.mod` di akar proyek/service dan entry `main.go`, `cmd/api/main.go`, atau `cmd/server/main.go`, serta wajib mendengarkan `PORT`. Untuk menyajikan frontend dan server Go dalam satu proyek dan satu domain, Vercel memakai **Services** (Beta): `vercel.json` berisi `services.web` (root `apps/web/`, Vite) dan `services.api` (root `api/`, framework `go`) dengan rewrite `/api/(.*)` → service `api`. Service menerima path asli (`/api/v1/...`). Sketsa `functions`/`@vercel/go` di atas tidak dipakai. Region fungsi diatur lewat dashboard (Settings → Functions → Region).

**Variabel lingkungan (diisi manual di dashboard Vercel → Settings → Environment Variables, dipisah untuk Production dan Preview):**
- `DATABASE_URL` — connection string pooler (transaction mode) dari Supabase
- `SESSION_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Nilai ini tidak pernah masuk repositori maupun `vercel.json`.

**Pipeline GitHub Actions**
- `ci.yml` (pull request dan push): lint (golangci-lint, ESLint, `tsc`), `go test ./...` dengan Postgres sebagai service, Vitest, build, Playwright (alur utama), pemeriksaan ukuran bundel.
- `migrate.yml` (push ke `main`): jalankan migrasi goose ke Supabase lewat session pooler (secret `MIGRATION_DATABASE_URL`). Berjalan terpisah dari deploy Vercel (yang otomatis jalan sendiri saat menerima push); untuk MVP ini dianggap cukup, dengan catatan risiko urutan di bagian 15.
- `keepalive.yml` (jadwal harian + `workflow_dispatch`): `curl --max-time 30 --retry 3 --retry-all-errors https://<domain-vercel>/api/v1/healthz` (D-15).
- **Deploy produksi dan preview dilakukan oleh integrasi Git bawaan Vercel**, bukan oleh GitHub Actions.

**Guardrail kuota**
- Tidak ada metode pembayaran di Vercel (D-17); tidak ada risiko tagihan.
- Jangan menjalankan pekerjaan berat (OCR, laporan besar) di backend agar CPU aktif bulanan tidak cepat habis.
- Cek pemakaian bandwidth, eksekusi fungsi, dan CPU aktif di dashboard Vercel, serta pemakaian Supabase, setiap akhir tahap.
- Ingat batas non-komersial (D-17) sebelum menambahkan pembayaran atau iklan.

**Aturan kerja dengan Claude Code dan platform**
1. Pengaturan awal dilakukan manual oleh pemilik proyek: membuat proyek Supabase, membuat proyek Vercel dan menghubungkannya ke repositori GitHub, mengisi variabel lingkungan di dashboard Vercel, dan menyimpan secret di GitHub Secrets.
2. Claude Code tidak diberi kredensial Vercel, Supabase, atau GitHub Secrets. Ia hanya menulis file di repositori (`vercel.json`, workflow, kode).
3. Tidak ada perintah yang mengubah proyek produksi dari mesin lokal (`vercel --prod` dari laptop dihindari). Perubahan produksi terjadi lewat push ke `main`, yang otomatis di-deploy Vercel.
4. Mode izin Claude Code dibiarkan default (meminta persetujuan sebelum perintah dijalankan). Jangan memakai `--dangerously-skip-permissions`.
5. Tambahkan aturan `deny` pada pengaturan izin Claude Code agar tidak membaca `.env` dan berkas rahasia lain.
6. Sebelum merge ke `main`, pemilik proyek meninjau perubahan pada `vercel.json`, workflow, dan migrasi database.

## 13. Strategi pengujian

- **Unit (Go):** aturan kategori otomatis, perhitungan saldo dan laporan, validasi.
- **Integrasi (Go):** handler + Postgres nyata (service container di CI). Wajib ada tes isolasi antarpengguna (pengguna A tidak bisa membaca/mengubah data pengguna B) dan tes bahwa semua tabel `public` memiliki RLS aktif.
- **Frontend (Vitest):** format uang, keypad, logika antrean offline, logika timeout/retry saat backend belum siap.
- **E2E (Playwright):** daftar → buat dompet → catat transaksi → lihat di laporan → atur anggaran → ekspor CSV. Jalankan juga dengan mode offline dan dengan API yang sengaja diperlambat (menguji pesan "Menyambungkan…").
- **Responsif (Playwright):** jalankan alur utama pada viewport 360×800, 390×844, 768×1024, 1366×768, dan 1920×1080; pastikan tidak ada scroll horizontal (`document.documentElement.scrollWidth <= window.innerWidth`) dan navigasi berubah sesuai breakpoint.
- **Non-fungsional:** Lighthouse CI (performa dan aksesibilitas) dengan throttling, cek ukuran bundel di CI.

## 14. Roadmap

| Tahap | Isi | Definisi selesai |
|---|---|---|
| M0 Fondasi | Repositori, Docker Compose, skema DB + migrasi awal (dengan RLS), `api-spec/openapi.yaml`, CI dasar, `CLAUDE.md`, entry point `api/index.go`, `/healthz`, **deploy kerangka ke Vercel + Supabase** (`vercel.json`, koneksi Vercel↔GitHub, `migrate.yml`, `keepalive.yml`) | `docker compose up` jalan; CI hijau; URL Vercel publik menjawab `/api/v1/healthz` dengan koneksi DB sukses; keep-alive berjalan; tanpa metode pembayaran |
| M1 Backend inti | Auth (email + Google), dompet, kategori + seed, transaksi CRUD, kategori otomatis | Semua KP F-01 sampai F-04 lulus tes; isolasi antarpengguna teruji |
| M2 Frontend inti | Kerangka responsif (HP, tablet, desktop), sistem desain dari `DESIGN.md`, **logo dan ikon dibuat Claude Code (F-14)**, masuk/daftar, beranda, tambah transaksi, daftar transaksi | Alur catat transaksi ≤ 10 detik; anggaran bundel terpenuhi; semua layar lolos uji viewport (F-13); logo terpilih dan terpasang |
| M3 Laporan dan anggaran | Laporan bulanan, grafik lazy-load, anggaran, ekspor CSV | KP F-05 dan F-06 lulus |
| M4 PWA, offline, dan cold start | Manifest, service worker (precache), antrean offline, sinkronisasi idempoten, UX cold start (D-16) | KP F-07 lulus; uji mode pesawat dan uji cold start |
| M5 Produksi | Finalisasi `vercel.json`, tes keamanan RLS dan isolasi, skrip ekspor `pg_dump`, halaman status, domain kustom (opsional), tinjauan kuota | Aplikasi lengkap berjalan di URL publik; tanpa biaya; checklist keamanan lulus |
| M6 Polesan portofolio | Lighthouse ≥ target, README (termasuk catatan cold start dan batas non-komersial Hobby), studi kasus, tangkapan layar, demo | Dokumentasi lengkap |
| Fase 2 | Foto struk, dompet e-wallet lanjutan, patungan | Per fitur |
| Fase 3 (opsional) | Upgrade ke Vercel Pro untuk pemakaian komersial, impor mutasi, premium | Per fitur |

Perkiraan awal: M0–M5 sekitar 4 minggu untuk pengembang solo dengan bantuan Claude Code. Sesuaikan setelah M1.

## 15. Risiko dan asumsi

| Risiko / asumsi | Mitigasi |
|---|---|
| Go runtime Vercel berstatus Beta dan bisa berubah perilakunya | Verifikasi dokumentasi terbaru sebelum implementasi; siapkan rencana pindah ke Cloud Run/Render bila runtime ini bermasalah (kode backend tetap portable karena hanya aplikasi Go biasa) |
| Nama field dan batas kuota `vercel.json`/Hobby berbeda antar sumber dan bisa berubah | Cek dashboard proyek dan dokumentasi resmi sebelum deploy; jangan asumsikan angka dari artikel pihak ketiga |
| Cold start fungsi backend | Precache service worker, pesan "Menyambungkan…", timeout dan retry wajar, antrean offline (D-16) |
| CPU aktif bulanan (± 4 jam) atau jumlah eksekusi habis | Jangan menjalankan pekerjaan berat di server; pantau dashboard; hitung agregat di SQL |
| Pemakaian komersial melanggar ketentuan Hobby | Tingkatkan ke Pro sebelum menjual (D-17, F-12); jangan aktifkan pembayaran/iklan di atas Hobby |
| Urutan migrasi database vs deploy kode tidak terjamin (dua pipeline terpisah: GitHub Actions untuk migrasi, Vercel untuk deploy) | Untuk MVP skala kecil risikonya rendah; migrasi dibuat aditif (kolom baru nullable dulu) agar aman dipakai kode versi lama maupun baru; pertimbangkan langkah "tunggu deploy Vercel selesai" di Fase 2 bila proyek berkembang |
| Proyek Supabase gratis dijeda setelah 7 hari tanpa aktivitas | Keep-alive harian via GitHub Actions (D-15), halaman status saat DB tidak tersedia, dokumentasikan cara memulihkan |
| Workflow terjadwal GitHub dinonaktifkan karena repositori tidak aktif | Pantau; commit rutin atau aktifkan ulang manual; pemeriksaan bulanan |
| Batas koneksi pada Supabase saat banyak *invocation* serverless bersamaan | Pooler transaction mode dengan pool sangat kecil per instance (D-13), koneksi disimpan sebagai variabel level-paket, retry di klien |
| Tabel terekspos lewat Data API Supabase | RLS wajib di semua tabel (D-12) dengan tes otomatis |
| Tidak ada cadangan otomatis di paket gratis | Skrip `pg_dump` terjadwal/manual, ekspor data per pengguna |
| Bundel membengkak (Recharts, OCR) | Lazy load, anggaran bundel di CI, alternatif grafik SVG sederhana |
| OCR tidak muat dalam batas eksekusi Vercel Hobby | Jangan jalankan OCR di backend (D-11); API eksternal opsional atau di browser |
| Tidak ada API resmi e-wallet | Dompet e-wallet manual + impor/OCR di Fase 3; komunikasikan jelas ke pengguna |
| Data keuangan bersifat sensitif | Isolasi per pengguna, ekspor/hapus akun, kebijakan privasi, tinjauan hukum sebelum komersial |
| Claude Code menjalankan perintah yang merusak | Tanpa kredensial platform, mode izin default, peninjauan sebelum merge (bagian 12) |
| Proyek tidak selesai karena ruang lingkup melebar | Patuhi batas MVP; fitur Fase 2/3 tidak disentuh sebelum M5 selesai |
| Nama "Fundly" sudah pernah dipakai pihak lain (mis. bekas platform crowdfunding di AS, dan sebuah aplikasi panduan pendanaan bisnis) | Cek domain, Play Store/App Store, dan merek dagang (DJKI/WIPO) sebelum rilis komersial; siapkan nama cadangan |
| Logo buatan AI terlalu generik atau mirip logo lain | Minta 3 konsep, pilih dan revisi; cek kemiripan lewat pencarian gambar dan merek sebelum dipakai komersial |
| Tata letak rusak di ukuran layar tertentu | Matriks viewport di Playwright (F-13), uji manual di HP sungguhan |

Asumsi: pengguna utama memakai Chrome/Android; bahasa antarmuka Bahasa Indonesia; mata uang rupiah; pengembang solo; laptop pengembang memakai Windows dengan Docker Desktop dan WSL2 (RAM 16 GB).

## 16. Pertanyaan terbuka

1. Nama produk sudah **Fundly**. Tersisa: domain (atau cukup subdomain `.vercel.app`) dan pengecekan ketersediaan nama/merek (lihat risiko).
2. Bagaimana memantau bahwa proyek Supabase tidak pernah dijeda dan workflow keep-alive tetap aktif (mis. cek manual mingguan)?
3. Apakah dukungan bahasa Inggris dibutuhkan di MVP? (Asumsi: tidak.)
4. Apakah pengguna perlu login sama sekali di MVP, atau mode tamu (data lokal saja) dulu? (Asumsi: login wajib.)
5. Kapan mulai memikirkan monetisasi, upgrade ke Vercel Pro, dan kewajiban hukumnya?

---

## Lampiran A: kategori bawaan

**Pengeluaran:** Makanan, Belanja, Transport, Tagihan, Kesehatan, Pendidikan, Hiburan, Rumah, Keluarga, Zakat/Donasi, Lainnya.
**Pemasukan:** Gaji, Usaha, Hadiah, Investasi, Lainnya.

## Lampiran B: instruksi untuk Claude Code

**Cara memakai dokumen ini.** Simpan `PRD.md` dan `DESIGN.md` di akar repositori. Buat `CLAUDE.md` berisi ringkasan aturan di bawah, lalu minta Claude Code mengerjakan **satu tahap (M0, M1, dst.) per sesi**, dimulai dari M0.

**Isi `CLAUDE.md` yang disarankan**
- Baca `PRD.md` dan `DESIGN.md` sebelum mengubah kode. Ikuti keputusan bertanda [Dxx]; jika perlu mengubahnya, tanyakan dulu dan perbarui PRD.
- Kerjakan hanya tahap yang diminta. Jangan menyentuh fitur Fase 2/3 sebelum diminta.
- Backend: Go, sqlc, goose, ditulis sebagai satu aplikasi server di `api/index.go` yang membaca `PORT` dari environment (bukan dipecah jadi banyak fungsi kecil per endpoint). Jangan menulis SQL string manual di handler; semua query lewat sqlc. Setiap query data pengguna wajib menyertakan `user_id` dari sesi. Backend harus stateless.
- Kontrak API berasal dari `api-spec/openapi.yaml`. Ubah spesifikasi dulu, lalu jalankan generator, lalu implementasi.
- Frontend: React + TypeScript + Tailwind; tipe API dibuat dari OpenAPI; token desain dari `DESIGN.md`. Jaga JS awal ≤ 150 KB gzip; impor library berat secara lazy. Terapkan penanganan cold start (D-16) di klien API.
- Uang selalu `BIGINT` rupiah di backend dan bilangan bulat di frontend; format hanya saat ditampilkan.
- Responsif: mobile-first dengan breakpoint pada D-18 dan tabel di `DESIGN.md`; setiap layar baru wajib lolos uji viewport F-13.
- Logo: dibuat sebagai SVG mengikuti bagian "Logo dan identitas" di `DESIGN.md`. Tampilkan 3 konsep dan tunggu pilihan pemilik proyek sebelum dipakai. Jangan menambah library berat untuk logo atau ikon.
- Setiap fitur baru wajib disertai tes (Go dan/atau Vitest/Playwright) dan lolos lint.
- Jangan pernah memasukkan rahasia ke repositori. Gunakan variabel lingkungan dan `.env.example`. Jangan membaca atau mencetak isi `.env`, dan jangan meminta pengguna menempelkan rahasia ke chat.
- Database: Supabase hanya sebagai Postgres. Setiap tabel baru wajib `ENABLE ROW LEVEL SECURITY` di migrasi yang sama. Jangan memakai Supabase Auth/Storage/Realtime dan jangan memakai kunci Supabase. Koneksi produksi lewat pooler transaction mode dengan pool sangat kecil (D-13); pengembangan lokal lewat Docker Compose dan `go run`.
- Hosting: Vercel Hobby. Jangan menjalankan OCR atau pekerjaan berat di backend. Jangan menyimpan file di disk lokal fungsi. Jangan meminta atau memakai kredensial Vercel, Supabase, atau GitHub Secrets; tulis hanya file di repositori dan minta pemilik proyek melakukan langkah dashboard secara manual.
- Sebelum menyarankan platform atau layanan baru, ingatkan pengguna untuk mengecek kuota gratis terbaru di halaman resminya.
- Di akhir tiap tahap: jalankan seluruh tes, periksa ukuran bundel, perbarui README, dan tulis ringkasan apa yang selesai dan apa yang belum.

**Langkah manual pemilik proyek sebelum deploy kerangka (M0, bagian 2):**
1. Buat proyek Supabase (region Singapore), ambil connection string pooler (transaction mode) dan session pooler.
2. Buat akun Vercel (login dengan GitHub), tanpa menambah metode pembayaran.
3. Setelah kode dasar ada di repositori, hubungkan repositori ke proyek Vercel baru lewat dashboard (Import Project). Atur `Root Directory` bila diperlukan sesuai struktur repo.
4. Isi Environment Variables di Vercel: `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
5. Simpan `MIGRATION_DATABASE_URL` di GitHub Secrets untuk `migrate.yml`.

**Contoh perintah pembuka untuk M0 (bagian lokal dulu):**
"Baca PRD.md dan DESIGN.md. Kerjakan tahap M0 bagian lokal: siapkan struktur repositori (termasuk folder `api/` sebagai entry point backend Go untuk Vercel), Docker Compose dengan Postgres, migrasi goose untuk skema di bagian 8 (setiap tabel dengan RLS aktif), kerangka `api-spec/openapi.yaml` dengan endpoint bagian 9, konfigurasi sqlc, endpoint `/healthz` yang menjalankan `SELECT 1`, dan `ci.yml` dasar. Jangan mengerjakan tahap lain dan jangan menyentuh Vercel atau Supabase. Berhenti dan ringkas setelah selesai."

**Contoh perintah lanjutan untuk M0 (deploy kerangka), dijalankan setelah pengaturan manual selesai:**
"Baca bagian 12 PRD.md. Tulis `vercel.json` untuk menjalankan `api/index.go` lewat Go runtime Vercel dan menyajikan `apps/web/dist` sebagai frontend, `migrate.yml` (migrasi goose lewat session pooler), dan `keepalive.yml` (ping harian ke `/api/v1/healthz`). Jangan meminta rahasia apa pun; sebutkan nama secret GitHub dan environment variable Vercel yang harus kubuat, dan langkah dashboard yang harus kulakukan sendiri. Berhenti setelah semua file siap untuk kutinjau."

**Contoh perintah untuk logo (tahap M2):**
"Baca bagian 'Logo dan identitas' di DESIGN.md dan F-14 di PRD.md. Buat 3 konsep logo Fundly sebagai SVG di `apps/web/public/brand/concepts/`, lalu buat satu halaman HTML pratinjau lokal yang menampilkan ketiganya berdampingan pada latar terang, gelap, dan dalam ukuran 16 px, 32 px, dan 128 px. Jangan memakai logo apa pun di aplikasi dulu. Berhenti dan tunggu pilihanku."

**Contoh perintah lanjutan setelah memilih logo:**
"Aku memilih konsep [nomor]. Finalisasi logo mark, wordmark, logo horizontal, dan versi satu warna. Turunkan favicon, ikon PWA 192 dan 512 (termasuk maskable), dan apple-touch-icon dari satu SVG sumber lewat skrip devDependency. Pasang di manifest dan `<head>`, lalu tampilkan logo di halaman masuk dan header/sidebar tanpa menambah bundel JS awal secara berarti."
