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
