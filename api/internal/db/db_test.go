package db_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/Wangjarimm/Fundly/api/internal/db"
	"github.com/Wangjarimm/Fundly/api/internal/db/store"
)

// testDatabaseURL mengembalikan TEST_DATABASE_URL. Di CI tes wajib jalan;
// di laptop tes dilewati bila Postgres lokal belum diatur.
func testDatabaseURL(t *testing.T) string {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		if os.Getenv("CI") != "" {
			t.Fatal("TEST_DATABASE_URL wajib diatur di CI")
		}
		t.Skip("TEST_DATABASE_URL tidak diatur; lewati tes integrasi")
	}
	return url
}

func TestMigrateAndRLS(t *testing.T) {
	url := testDatabaseURL(t)
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	if _, err := db.Migrate(ctx, url); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	// Migrasi kedua harus no-op (idempoten).
	if _, err := db.Migrate(ctx, url); err != nil {
		t.Fatalf("migrate ulang: %v", err)
	}

	pool, err := db.Open(ctx, url, 2)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	// D-12: setiap tabel di skema public wajib RLS aktif.
	rows, err := pool.Query(ctx, `
		SELECT c.relname
		FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public'
		  AND c.relkind IN ('r', 'p')
		  AND NOT c.relrowsecurity
		ORDER BY c.relname`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var missing []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatal(err)
		}
		missing = append(missing, name)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	if len(missing) > 0 {
		t.Fatalf("tabel tanpa RLS di skema public: %v", missing)
	}

	// Pastikan tabel inti memang ada (tes di atas tidak lulus karena skema kosong).
	var count int
	if err := pool.QueryRow(ctx, `
		SELECT count(*) FROM pg_tables
		WHERE schemaname = 'public'
		  AND tablename IN ('users','sessions','wallets','categories','transactions','budgets','category_rules')`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 7 {
		t.Fatalf("jumlah tabel inti = %d, want 7", count)
	}
}

// Lapisan kedua setelah RLS (migrasi 00004): role Data API Supabase tidak boleh
// punya hak apa pun atas tabel public. Lokal/CI memakai role tiruan dari
// scripts/supabase-roles.sql (dengan default grant seperti Supabase).
func TestDataAPIRolesHaveNoPrivileges(t *testing.T) {
	url := testDatabaseURL(t)
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	pool, err := db.Open(ctx, url, 2)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	var roles int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated')`).Scan(&roles); err != nil {
		t.Fatal(err)
	}
	if roles < 2 {
		if os.Getenv("CI") != "" {
			t.Fatal("role tiruan Supabase belum dibuat; jalankan scripts/supabase-roles.sql sebelum tes")
		}
		t.Skip("role anon/authenticated tidak ada; jalankan scripts/supabase-roles.sql")
	}

	// Beri hak seperti default Supabase, lalu migrasi harus mencabutnya.
	if _, err := pool.Exec(ctx, `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM goose_db_version WHERE version_id = 4`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Migrate(ctx, url); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	rows, err := pool.Query(ctx, `
		SELECT r.rolname, c.relname
		FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
		WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
		  AND has_table_privilege(r.rolname, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
		ORDER BY 1, 2`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var leaks []string
	for rows.Next() {
		var role, table string
		if err := rows.Scan(&role, &table); err != nil {
			t.Fatal(err)
		}
		leaks = append(leaks, role+"→"+table)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	if len(leaks) > 0 {
		t.Fatalf("role Data API masih punya hak: %v", leaks)
	}

	// Tabel baru yang dibuat setelahnya juga tidak otomatis terbuka.
	if _, err := pool.Exec(ctx, `CREATE TABLE tmp_default_priv_check (id int)`); err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = pool.Exec(context.Background(), `DROP TABLE IF EXISTS tmp_default_priv_check`) }()
	var open bool
	if err := pool.QueryRow(ctx, `SELECT has_table_privilege('anon', 'tmp_default_priv_check', 'SELECT')`).Scan(&open); err != nil {
		t.Fatal(err)
	}
	if open {
		t.Fatal("default privileges masih memberi akses anon ke tabel baru")
	}
}

func TestPingQuery(t *testing.T) {
	url := testDatabaseURL(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.Open(ctx, url, 1)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	got, err := store.New(pool).Ping(ctx)
	if err != nil {
		t.Fatalf("ping: %v", err)
	}
	if got != 1 {
		t.Fatalf("ping = %d, want 1", got)
	}
}
