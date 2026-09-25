# Checklist keamanan dan produksi Fundly (M5)

Setiap butir menyebut cara verifikasinya. "Otomatis" berarti diperiksa di CI atau workflow terjadwal.

## Data dan database

| Butir | Status | Verifikasi |
|---|---|---|
| RLS aktif di semua tabel `public` (D-12) | ✅ | Otomatis: `TestMigrateAndRLS` gagal bila ada tabel tanpa RLS |
| Role Data API (`anon`, `authenticated`) tanpa hak atas tabel, termasuk tabel baru | ✅ | Otomatis: `TestDataAPIRolesHaveNoPrivileges` dengan role tiruan (`scripts/supabase-roles.sql`); migrasi `00004` |
| Data API Supabase tidak mengembalikan data dengan kunci publik | ⏳ butuh secret | Otomatis mingguan: `security.yml` → `scripts/check-rls.sh` (secret `SUPABASE_URL`, `SUPABASE_ANON_KEY`) |
| Isolasi antarpengguna (baca, ubah, hapus, laporan, anggaran, ekspor) | ✅ | Otomatis: `TestUserIsolation`, `TestReportAndBudgetIsolation`, `TestExportCSV` |
| Semua query lewat sqlc dan dibatasi `user_id` sesi | ✅ | Tinjauan kode `api/internal/db/queries/*.sql` |
| Kunci Supabase tidak dipakai aplikasi | ✅ | Backend hanya `DATABASE_URL`; frontend tanpa kunci |
| Koneksi produksi lewat pooler transaction mode, pool kecil, tanpa prepared statement cache (D-13) | ✅ | `api/internal/db/db.go` |
| Cadangan database terenkripsi (repo publik) | ⏳ butuh secret | `backup.yml` mingguan: `pg_dump` → gzip → GPG AES-256 (secret `BACKUP_PASSPHRASE`) |

## Autentikasi dan sesi

| Butir | Status | Verifikasi |
|---|---|---|
| Password argon2id, minimal 8 karakter | ✅ | `internal/auth` + tes |
| Cookie sesi `HttpOnly`, `Secure`, `SameSite=Lax`, 30 hari, diperpanjang saat aktif | ✅ | `TestAuthRegisterLoginLogout`, `TestSessionSlidingExpiry` |
| Token sesi hanya disimpan sebagai hash SHA-256 | ✅ | `internal/auth/token.go` |
| Logout dan ganti password mencabut sesi di server | ✅ | `TestAuthRegisterLoginLogout`, `TestUpdateMeAndDeleteAccount` |
| Header CSRF wajib untuk POST/PUT/PATCH/DELETE | ✅ | `TestAuthRequiredAndCSRF` |
| Rate limit login/daftar/saran/ekspor/healthz | ✅ | `TestAuthRateLimit`, `TestHealthzRateLimited` |
| Google OAuth: PKCE, state HMAC sekali pakai, hanya email terverifikasi | ✅ | `TestGoogleLogin` |
| Penautan Google ke akun email lama menghapus password lama (cegah pengambilalihan) | ✅ | `TestGoogleLogin` |
| IP klien untuk rate limit tidak bisa dipalsukan lewat header | ✅ | `TestClientIP` |

## Web dan infrastruktur

| Butir | Status | Verifikasi |
|---|---|---|
| CSP ketat, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, HSTS, `Permissions-Policy` di frontend | ⏳ setelah merge | `vercel.json`; otomatis: job `headers` di `security.yml` |
| Header keamanan di respons API | ✅ | `middleware.go` |
| Ekspor CSV menetralkan formula spreadsheet | ✅ | `TestCSVSafe`, `TestExportCSV` |
| Error tidak membocorkan detail internal; log tanpa rahasia | ✅ | `respond.go` (`fail`), `cmd/migrate` tidak mencetak URL |
| Rahasia hanya di Vercel Environment Variables dan GitHub Secrets | ✅ | `.gitignore`, `.env.example` tanpa nilai rahasia |
| Tanpa metode pembayaran di Vercel; tanpa monetisasi di paket Hobby (D-17) | Pemilik proyek | Dashboard Vercel → Billing |

## Tinjauan kuota (setiap akhir tahap, manual)

- Vercel → proyek → **Usage**: bandwidth (±100 GB), invocations (±1 juta), Active CPU (±4 jam). Angka pasti: lihat dashboard.
- Supabase → **Reports / Usage**: ukuran database (500 MB), egress.
- GitHub → **Actions**: `keepalive` berjalan tiap hari (jadwal bisa dinonaktifkan GitHub setelah ±60 hari repo tanpa aktivitas).
