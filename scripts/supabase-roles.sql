-- Meniru role Data API Supabase di Postgres lokal/CI agar migrasi pencabutan hak
-- (00004) benar-benar teruji. Aman dijalankan berulang.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
END
$$;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
-- Seperti Supabase: tabel baru otomatis bisa diakses role Data API.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
