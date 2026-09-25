---
name: Fundly
description: Sistem desain aplikasi pencatat keuangan pribadi yang ramah untuk semua usia dan ringan di HP spek rendah.
colors:
  primary: "#2F3E9E"
  on-primary: "#FFFFFF"
  primary-container: "#E3E6FA"
  on-primary-container: "#1E2A75"
  accent: "#F5B301"
  on-accent: "#1B2130"
  income: "#17784A"
  income-container: "#DDF3E6"
  expense: "#C23434"
  expense-container: "#FBE4E2"
  warning: "#8A5A00"
  warning-container: "#FFF1CC"
  background: "#F5F6FA"
  surface: "#FFFFFF"
  surface-variant: "#ECEEF5"
  ink: "#1B2130"
  ink-muted: "#4E566B"
  outline: "#D5D9E6"
  dark-background: "#0E1220"
  dark-surface: "#171C2E"
  dark-surface-variant: "#222840"
  dark-ink: "#EEF0F8"
  dark-ink-muted: "#B4BAD0"
  dark-primary: "#A9B6FF"
  dark-on-primary: "#141B4D"
  dark-income: "#5FD39A"
  dark-expense: "#FF8A84"
  dark-outline: "#33395A"
typography:
  display:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 2.25rem
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.02em
  headline:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 1.375rem
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 1.0625rem
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  body-small:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 0.875rem
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: 8px
  md: 14px
  lg: 24px
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  tap-target: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    height: 52px
    padding: 0 24px
  button-secondary:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    rounded: "{rounded.md}"
    height: 48px
    padding: 0 20px
  button-add:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.full}"
    height: 60px
    width: 60px
  card-hero:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
    padding: 24px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 16px
  transaction-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: 64px
    padding: 8px 16px
  chip:
    backgroundColor: "{colors.surface-variant}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: 40px
    padding: 0 16px
  chip-suggested:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    rounded: "{rounded.full}"
    height: 40px
    padding: 0 16px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: 52px
    padding: 0 16px
  bottom-nav:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    height: 64px
---

# DESIGN.md: Fundly

Dokumen ini adalah sistem desain untuk **Fundly**, aplikasi web pencatat keuangan pribadi yang responsif (HP, tablet, dan komputer). Nama Fundly berasal dari "fund" (dana) dan akhiran "-ly" (dengan cara), yaitu mengelola dana dengan cara yang sederhana. Pakai file ini di Google Stitch agar semua layar yang dihasilkan konsisten, dan pakai juga sebagai acuan token saat frontend dibuat (Tailwind + shadcn/ui). Pasangannya adalah `PRD.md`.

## Overview

**Kesan yang dituju:** hangat, tenang, dan bisa dipercaya, seperti buku kas rapi milik keluarga yang sudah dimodernkan. Bukan aplikasi bank yang kaku, bukan pula aplikasi gim yang ramai. Pengguna harus merasa "aku paham uangku" dalam sekali lihat.

**Untuk siapa:** semua orang. Mahasiswa, pekerja, ibu rumah tangga, pedagang kecil, sampai orang tua yang baru pertama kali mencatat keuangan digital. Karena itu desainnya mengutamakan keterbacaan, target sentuh besar, dan bahasa sehari-hari.

**Satu hal yang paling diingat:** kartu utama "Sisa uang bulan ini" berwarna indigo pekat dengan angka besar dan pola **kawung** (motif batik empat elips bersinggungan) yang sangat halus di latarnya. Semua elemen lain sengaja tenang supaya kartu ini menjadi jangkar visual. Pola kawung hanya muncul di kartu ini, tidak di tempat lain.

**Akar visual (Indonesia, tanpa klise):** indigo dari kain batik, kuning kunyit sebagai aksen hangat, hijau pandan untuk uang masuk, merah cabai untuk uang keluar, latar putih kapur yang dingin (bukan krem). Tidak ada gradien, tidak ada bayangan tebal, tidak ada dekorasi yang tidak punya fungsi.

**Ringan sebagai bagian dari desain:** desain ini sengaja murah dirender di HP lama. Tanpa gambar dekoratif besar, tanpa blur, tanpa bayangan berlapis, ikon berupa SVG garis, dan satu keluarga font.

## Colors

Palet inti (mode terang):

| Nama | Hex | Peran |
|---|---|---|
| Indigo batik (`primary`) | `#2F3E9E` | Kartu hero, tombol utama, tautan, tab aktif |
| Kunyit (`accent`) | `#F5B301` | Hanya untuk tombol tambah (+) dan satu sorotan penting per layar |
| Pandan (`income`) | `#17784A` | Uang masuk, status aman |
| Cabai (`expense`) | `#C23434` | Uang keluar, anggaran terlampaui |
| Kapur (`background`) | `#F5F6FA` | Latar halaman (putih dingin, bukan krem) |
| Tinta (`ink`) | `#1B2130` | Teks utama (hampir hitam kebiruan) |

Aturan pemakaian:
- Kunyit dipakai hemat: satu tombol tambah per layar. Jangan dipakai untuk latar area lebar atau teks kecil. Teks di atas kunyit selalu `on-accent` (`#1B2130`).
- **Warna tidak pernah jadi satu-satunya penanda.** Uang masuk selalu diawali `+` dan ikon panah turun-kiri; uang keluar selalu `−` dan ikon panah naik-kanan. Status anggaran memakai ikon dan teks ("Aman", "Hampir habis", "Terlampaui") selain warna.
- Kontras teks target ≥ 4,5:1 (teks besar ≥ 3:1). Nilai di atas dipilih untuk memenuhinya; verifikasi ulang dengan alat pemeriksa kontras setelah ada perubahan.
- Kontainer (`*-container`) adalah versi pucat untuk lencana dan latar kecil; teks di atasnya memakai warna pasangan yang lebih tua.
- **Mode gelap** memakai token berawalan `dark-`: latar `#0E1220`, permukaan `#171C2E`, teks `#EEF0F8`. Warna indigo, pandan, dan cabai diganti versi lebih terang (`dark-primary`, `dark-income`, `dark-expense`) agar tetap terbaca. Kartu hero di mode gelap memakai `dark-surface-variant` dengan teks terang. Ikuti pengaturan sistem secara default dan sediakan pilihan manual di Pengaturan.

## Typography

Satu keluarga font: **Plus Jakarta Sans** (dirancang di Indonesia, ramah dan jelas untuk angka). Muat hanya subset Latin dengan bobot 400, 600, dan 700, dengan `font-display: swap`. Cadangan: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Jika font gagal dimuat, tata letak tidak boleh bergeser jauh.

| Gaya | Ukuran / bobot | Dipakai untuk |
|---|---|---|
| Display | 2,25 rem / 700 | Angka besar di kartu hero |
| Headline | 1,375 rem / 600 | Judul layar |
| Title | 1,0625 rem / 600 | Judul kartu, nama transaksi |
| Body | 1 rem / 400 | Teks umum, isi formulir |
| Body small | 0,875 rem / 400 | Keterangan, tanggal, nama dompet |
| Label | 0,875 rem / 600 | Tombol kecil, chip, tab |

Aturan:
- Angka uang selalu memakai angka tabular (`font-variant-numeric: tabular-nums`) supaya kolom rapi dan mudah dibandingkan.
- Format rupiah: `Rp 87.500` (titik sebagai pemisah ribuan, spasi setelah "Rp"). Untuk ruang sempit boleh memakai `87,5 rb` atau `6,5 jt`, tapi angka lengkap selalu tersedia di detail.
- Teks utama tidak pernah di bawah 16 px. Teks 14 px hanya untuk keterangan pendukung dan tetap harus lolos kontras.
- Lebar baris teks maksimal sekitar 65 karakter. Kalimat sentence case; tidak ada teks huruf kapital semua untuk label.
- Dukung pembesaran teks sampai 200% tanpa tumpang tindih atau terpotong.

## Layout

- **Mobile-first**, dirancang pertama untuk lebar 360 px. Satu kolom, konten mengalir vertikal.
- Jarak berbasis kelipatan 4 px. Margin samping 16 px; jarak antarbagian 24 px.
- **Zona jempol:** aksi terpenting (tambah transaksi, simpan) berada di bagian bawah layar. Navigasi bawah tetap dengan 5 item: Beranda, Transaksi, Tambah (kunyit, di tengah), Laporan, Lainnya.
- **Layar lebar (≥ 1024 px):** sidebar kiri, beranda dua kolom (ringkasan di kiri, transaksi terbaru di kanan), lebar konten maksimal 1120 px rata kiri. Perilaku lengkap untuk semua ukuran ada di bagian Breakpoint dan perilaku responsif di bawah.
- Perataan: teks rata kiri. Angka uang di daftar rata kanan agar sejajar. Kartu hero rata kiri.
- Urutan beranda: sapaan singkat → kartu hero (sisa uang, uang masuk, uang keluar) → status anggaran yang perlu perhatian → transaksi terbaru → ringkasan kategori.
- Target sentuh minimal 48 × 48 px dengan jarak antar-target minimal 8 px.

### Breakpoint dan perilaku responsif

Aplikasi ini satu basis kode yang harus nyaman di HP, tablet, dan komputer. Rancang HP dulu (mobile-first), lalu tambahkan untuk layar yang lebih besar.

| Lebar | Perangkat | Navigasi | Tata letak |
|---|---|---|---|
| < 640 px | HP | Bar bawah 5 item | Satu kolom, margin 16 px, form transaksi sebagai bottom sheet |
| 640–767 px | HP besar / landscape | Bar bawah | Satu kolom, margin 24 px; kartu ringkasan boleh berjajar dua |
| 768–1023 px | Tablet | Rail ikon di kiri (label di bawah ikon) | Beranda dan laporan dua kolom bila cukup; form transaksi sebagai dialog di tengah |
| 1024–1279 px | Laptop kecil | Sidebar penuh | Beranda dan laporan dua kolom; lebar konten maksimal 1120 px |
| ≥ 1280 px | Desktop | Sidebar penuh | Sama; konten rata kiri dalam wadah 1120 px, sisa ruang dibiarkan kosong (jangan meregangkan kartu) |

Aturan:
- Gaya dasar untuk HP, lalu tambahkan untuk `sm`, `md`, `lg`, `xl` (breakpoint bawaan Tailwind).
- Tanpa scroll horizontal pada halaman. Tabel atau grafik lebar boleh scroll di dalam wadahnya sendiri; di HP daftar transaksi berbentuk baris, bukan tabel.
- Pakai unit relatif (`rem`, `%`), flex/grid, dan `clamp()` untuk ukuran display. Grafik memakai SVG dengan `viewBox` agar skalanya otomatis.
- Safe-area: `viewport-fit=cover` dan `env(safe-area-inset-*)` untuk notch dan home indicator. Gunakan `dvh` agar bilah alamat browser HP tidak memotong tombol.
- Sentuh, mouse, dan keyboard setara. Tidak ada aksi yang hanya bisa lewat hover. Di desktop keypad juga menerima ketikan keyboard, dan Enter menyimpan transaksi.
- Portrait dan landscape didukung; jangan mengunci orientasi.
- Uji pada 360×800, 390×844, 768×1024, 1366×768, 1920×1080, dan pada zoom 200%.

## Elevation & Depth

Desain **datar dan tonal**: kedalaman dibuat dari perbedaan warna permukaan dan garis tepi tipis, bukan bayangan.
- Halaman: `background`. Kartu: `surface` dengan garis tepi 1 px `outline`.
- Bayangan hanya untuk dua hal yang benar-benar melayang: tombol tambah (bayangan kecil satu lapis) dan bottom sheet (garis atas + latar gelap transparan di belakangnya).
- Tanpa efek blur, gradien, atau bayangan berlapis, karena berat di perangkat lemah.

## Shapes

Sudut membulat dengan **tingkatan yang punya arti**, bukan satu radius untuk semuanya:
- `sm` 8 px: baris daftar, input kecil
- `md` 14 px: kartu biasa, tombol, kolom isian
- `lg` 24 px: kartu hero, bottom sheet (sudut atas)
- `full`: chip, tombol tambah, lencana

Ikon: gaya garis (outline) 1,5–2 px, satu set ikon konsisten (mis. Tabler atau Lucide), ukuran 20–24 px. Tanpa emoji di antarmuka. Setiap kategori punya ikon garis dan satu warna dari palet kontainer.

## Components

**Tombol utama (`button-primary`)** — latar indigo, teks putih, tinggi 52 px, lebar penuh untuk aksi simpan. Satu tombol utama per layar.

**Tombol sekunder (`button-secondary`)** — latar indigo pucat, teks indigo tua.

**Tombol tambah (`button-add`)** — lingkaran kunyit 60 px di tengah navigasi bawah, ikon plus garis tebal. Satu-satunya elemen berwarna kunyit yang besar.

**Kartu hero (`card-hero`)** — latar indigo, pola kawung putih dengan opasitas sekitar 8%, sudut 24 px. Berisi label "Sisa uang bulan ini", angka display putih, lalu dua lencana kecil di bawahnya: uang masuk (ikon panah turun-kiri, "+") dan uang keluar (ikon panah naik-kanan, "−"). Pola kawung berupa satu ubin SVG kecil yang diulang, bukan gambar besar.

**Baris transaksi (`transaction-row`)** — ikon kategori dalam kotak 40 px berlatar kontainer, di tengah nama merchant (title) dan keterangan "dompet · kategori" (body small), di kanan jumlah (`+`/`−`, rata kanan, warna sesuai jenis). Dikelompokkan per hari dengan judul tanggal.

**Kolom isian (`input`)** — tinggi 52 px, label selalu tampak di atas (bukan hanya placeholder), pesan error jelas di bawah kolom dengan ikon.

**Keypad jumlah** — angka besar (display) di atas, papan angka 3 × 4 dengan tombol minimal 64 px, tombol hapus, pemisah ribuan otomatis.

**Chip kategori (`chip`, `chip-suggested`)** — chip biasa berlatar abu pucat; chip saran otomatis berlatar indigo pucat dengan ikon percikan kecil dan teks "Disarankan: Belanja". Ketuk untuk menerima.

**Progres anggaran** — batang tipis 8 px berujung bulat, di kanannya "Rp terpakai / Rp batas", di bawahnya status berupa ikon + teks: "Aman" (pandan), "Hampir habis" (kunyit tua `warning`), "Terlampaui" (cabai).

**Navigasi bawah (`bottom-nav`)** — 5 item, ikon + label selalu terlihat (bukan hanya ikon). Item aktif indigo dengan penanda pil di belakang ikon. Di layar ≥ 768 px navigasi ini menjadi rail atau sidebar (lihat Breakpoint dan perilaku responsif).

**Bottom sheet** — untuk form tambah/ubah transaksi di HP (di layar ≥ 768 px menjadi dialog di tengah); sudut atas 24 px, pegangan kecil di atas, tombol simpan menempel di bawah.

**Toast** — muncul di atas navigasi bawah; untuk hapus selalu ada tombol "Batalkan". Pesan singkat dan berbentuk kejadian selesai ("Transaksi dihapus").

**Grafik (laporan)** — sederhana dan mudah dibaca: batang horizontal per kategori dengan label langsung di batang (tidak bergantung legenda warna), dan satu grafik tren harian. Tidak memakai diagram pai. Setiap grafik punya ringkasan teks di bawahnya untuk pembaca layar.

**Keadaan kosong** — ajakan, bukan permintaan maaf. Contoh: "Belum ada catatan bulan ini. Catat pengeluaran pertamamu" dengan tombol "Catat pengeluaran".

**Keadaan offline** — lencana kecil "Offline" di bagian atas dan status "Menunggu sinkron" pada transaksi yang belum terkirim.

## Logo dan identitas

Logo Fundly dibuat otomatis oleh Claude Code sebagai SVG berdasarkan brief ini. Claude Code menyiapkan **tiga konsep**, menampilkannya berdampingan di satu halaman pratinjau, lalu pemilik proyek memilih dan meminta revisi (lihat F-14 di `PRD.md`).

**Makna nama:** "Fundly" = "fund" (dana) + "-ly" (dengan cara). Pesannya: mengelola dana dengan cara yang sederhana. Logo harus terasa tenang, jelas, dan ramah, bukan kaku seperti bank.

**Brief logo**
- **Bentuk:** logo mark (ikon) yang bisa berdiri sendiri, ditambah wordmark "Fundly". Wordmark memakai Plus Jakarta Sans bobot 700 (atau huruf yang digambar ulang sebagai path SVG agar tidak bergantung pada font), hanya huruf F kapital, sisanya huruf kecil.
- **Arah ide (pilih dan kembangkan, jangan gabungkan semuanya):** (1) huruf "F" yang dibentuk dari garis-garis buku kas, dengan dua palang F seperti dua baris catatan; (2) "F" dengan satu titik atau lingkaran kunyit kecil sebagai koin atau titik jumlah; (3) bentuk kantong atau dompet yang disederhanakan menjadi huruf F. Geometris, sederhana, sudut membulat selaras dengan `rounded.md`.
- **Warna:** indigo `#2F3E9E` sebagai warna utama, kunyit `#F5B301` hanya untuk satu aksen kecil. Sediakan versi satu warna (indigo tua atau putih) untuk latar terang dan gelap.
- **Hindari klise:** tanda dolar, celengan babi, panah naik generik, gradien, bayangan, kilau, dan detail halus yang hilang pada ukuran kecil. Pola kawung tidak dipakai di logo (tetap eksklusif untuk kartu hero).
- **Teknis:** SVG bersih tanpa gambar raster tertanam, dari bentuk sederhana (path, rect, circle). Logo mark di bawah 3 KB, terbaca pada 16 px dan dalam satu warna, dengan area aman di sekelilingnya sebesar tinggi huruf "F".

**Aset yang dihasilkan** (di `apps/web/public/brand/` dan `apps/web/public/icons/`)

| Aset | Keterangan |
|---|---|
| `logo-mark.svg` | Ikon saja |
| `logo-wordmark.svg` | Tulisan Fundly saja |
| `logo-horizontal.svg` | Ikon dan tulisan berdampingan |
| `logo-mono-dark.svg`, `logo-mono-light.svg` | Satu warna untuk latar terang dan gelap |
| `favicon.svg`, `favicon.ico` | Tab browser |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Ikon PWA (versi maskable dengan zona aman) |
| `apple-touch-icon.png` (180 px) | Layar utama iOS |
| `og-image.png` (opsional) | Pratinjau saat dibagikan |

Ikon PNG diturunkan dari satu SVG sumber lewat skrip (alat hanya di devDependencies, tidak masuk bundel).

**Pemakaian:** logo horizontal di halaman masuk dan header atau sidebar; logo mark di rail navigasi yang sempit, favicon, dan ikon aplikasi. Jangan meregangkan, memutar, atau mewarnai ulang di luar palet, dan jangan menaruhnya di latar yang kontrasnya rendah. Logo tidak dipakai di kartu hero agar tidak bersaing dengan angka sisa uang.

## Motion

Gerak seminimal mungkin dan hanya untuk memberi tahu apa yang berubah: sheet naik saat dibuka, toast muncul, progres anggaran terisi saat nilai berubah. Durasi 150–250 ms. Tidak ada animasi otomatis tanpa aksi pengguna. Hormati `prefers-reduced-motion` (matikan semua gerak non-esensial).

## Copywriting

- Bahasa Indonesia sehari-hari yang sopan dan singkat. Hindari pronomina jika bisa; jika perlu, pakai "kamu". Tidak menggurui.
- Nama aksi konsisten di seluruh alur: tombol "Simpan transaksi" → toast "Transaksi disimpan".
- Istilah sederhana: "Sisa uang", "Uang masuk", "Uang keluar", "Dompet", "Anggaran". Hindari "saldo neto", "arus kas", dan sejenisnya.
- Perbandingan bulan bersifat netral: "Pengeluaran turun 8% dari bulan lalu", bukan pujian atau teguran.
- Pesan error menjelaskan apa yang terjadi dan apa yang perlu dilakukan, tanpa menyalahkan pengguna dan tanpa permintaan maaf: "Jumlah harus lebih dari 0. Ketik angka lalu simpan."

## Layar yang perlu didesain (untuk prompt Stitch)

Buat semua layar dalam versi HP (360 × 800) dulu, lalu versi tablet (768 × 1024) dan desktop (1280 × 800) untuk beranda dan laporan, mengikuti tabel Breakpoint di bagian Layout. Tiap layar hadir dalam mode terang dan gelap.

1. Masuk dan daftar (email, tombol Google)
2. Beranda dengan kartu hero, status anggaran, transaksi terbaru
3. Tambah transaksi (bottom sheet dengan keypad, pilihan dompet, chip kategori disarankan)
4. Daftar transaksi dengan pencarian dan filter
5. Laporan bulanan (ringkasan, batang per kategori, tren harian, banding bulan lalu)
6. Anggaran per kategori
7. Dompet (daftar dan ubah)
8. Kategori (daftar dan ubah)
9. Pengaturan (profil, tema, ekspor data, hapus akun)
10. Keadaan kosong, error, dan offline untuk beranda dan daftar transaksi

**Contoh prompt pembuka di Stitch:** "Rancang aplikasi web mobile pencatat keuangan pribadi bernama Fundly untuk semua usia di Indonesia, sesuai DESIGN.md. Buat layar Beranda dengan kartu hero indigo berpola kawung halus yang menampilkan sisa uang bulan ini, dua lencana uang masuk dan uang keluar, status anggaran, dan lima transaksi terbaru. Navigasi bawah lima item dengan tombol tambah kunyit di tengah."

## Do's and Don'ts

**Do**
- Pakai indigo untuk aksi dan identitas, kunyit hanya untuk tombol tambah dan satu sorotan.
- Selalu sertakan tanda `+`/`−`, ikon, dan teks status di samping warna.
- Jaga target sentuh ≥ 48 px dan teks utama ≥ 16 px.
- Utamakan kecepatan mencatat: jumlah dulu, detail belakangan.
- Uji tampilan pada lebar 360 px, teks 200%, dan mode gelap.
- Uji juga pada tablet (768 px) dan desktop (1280 px ke atas); tata letak harus mengikuti tabel breakpoint.
- Pakai logo mark di ruang sempit dan logo horizontal di header atau sidebar.

**Don't**
- Jangan pakai gradien, blur, bayangan tebal, atau gambar dekoratif besar.
- Jangan pakai latar krem/terakota, atau tema hitam pekat dengan aksen neon.
- Jangan pakai diagram pai atau legenda yang hanya dibedakan lewat warna.
- Jangan pakai teks kapital semua untuk label, dan jangan tampilkan lebih dari satu tombol utama per layar.
- Jangan menaruh pola kawung di luar kartu hero.
- Jangan menghakimi pengguna lewat kata-kata ("boros", "kebanyakan") di antarmuka.
- Jangan membuat tampilan desktop hanya berupa versi HP yang diregangkan.
- Jangan meregangkan logo, mengubah warnanya di luar palet, atau membuat logo dengan gradien, bayangan, dan detail yang hilang di ukuran kecil.
