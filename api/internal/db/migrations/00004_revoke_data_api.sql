-- +goose Up
-- Lapisan kedua setelah RLS (D-12): di Supabase, role anon dan authenticated
-- dipakai Data API. Aplikasi tidak memakai Data API sama sekali, jadi semua hak
-- mereka atas skema public dicabut, termasuk untuk tabel yang dibuat nanti.
-- Role ini tidak ada di Postgres lokal/CI, jadi pencabutan hanya dijalankan
-- bila role tersebut ada (migrasi tetap identik di semua lingkungan, D-14).
-- +goose StatementBegin
DO $$
DECLARE
    r TEXT;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
            EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
            EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
            EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
            EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
            EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
        END IF;
    END LOOP;
END
$$;
-- +goose StatementEnd

-- +goose Down
-- Sengaja tidak mengembalikan hak Data API.
SELECT 1;
