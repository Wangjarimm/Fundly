// Command migrate menerapkan migrasi goose ke database di MIGRATION_DATABASE_URL
// (atau DATABASE_URL bila kosong, untuk pengembangan lokal).
package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/Wangjarimm/Fundly/api/internal/db"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	url := os.Getenv("MIGRATION_DATABASE_URL")
	if url == "" {
		url = os.Getenv("DATABASE_URL")
	}
	if url == "" {
		logger.Error("MIGRATION_DATABASE_URL atau DATABASE_URL belum diatur")
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	results, err := db.Migrate(ctx, url)
	if err != nil {
		// Jangan mencetak URL: bisa berisi password.
		logger.Error("migrasi gagal", "err", err)
		os.Exit(1)
	}
	for _, r := range results {
		logger.Info("migrasi diterapkan", "version", r.Source.Version, "file", r.Source.Path, "duration", r.Duration.String())
	}
	logger.Info("migrasi selesai", "applied", len(results))
}
