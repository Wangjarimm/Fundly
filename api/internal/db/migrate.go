package db

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"

	_ "github.com/jackc/pgx/v5/stdlib" // driver "pgx" untuk database/sql
	"github.com/pressly/goose/v3"
)

// Migrate menjalankan semua migrasi goose yang belum diterapkan.
// Di produksi dipanggil dari GitHub Actions lewat session pooler (D-13),
// bukan dari fungsi Vercel.
func Migrate(ctx context.Context, url string) ([]*goose.MigrationResult, error) {
	sqlDB, err := sql.Open("pgx", url)
	if err != nil {
		return nil, fmt.Errorf("open: %w", err)
	}
	defer func() { _ = sqlDB.Close() }()

	fsys, err := fs.Sub(Migrations, "migrations")
	if err != nil {
		return nil, err
	}
	provider, err := goose.NewProvider(goose.DialectPostgres, sqlDB, fsys)
	if err != nil {
		return nil, fmt.Errorf("goose provider: %w", err)
	}
	return provider.Up(ctx)
}
