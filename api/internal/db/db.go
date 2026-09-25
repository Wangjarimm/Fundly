// Package db mengelola koneksi Postgres dan migrasi goose.
package db

import (
	"context"
	"embed"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Migrations berisi file migrasi goose yang ditanam ke dalam binary.
//
//go:embed migrations/*.sql
var Migrations embed.FS

// Open membuat pool pgx yang aman untuk Supabase transaction pooler (D-13):
// pool kecil, tanpa prepared statement cache (simple protocol), dan koneksi
// dibuka secara malas sehingga cold start tidak menunggu database.
func Open(ctx context.Context, url string, maxConns int32) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	if maxConns < 1 {
		maxConns = 1
	}
	cfg.MaxConns = maxConns
	cfg.MinConns = 0
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	cfg.ConnConfig.StatementCacheCapacity = 0
	cfg.ConnConfig.DescriptionCacheCapacity = 0

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("open pool: %w", err)
	}
	return pool, nil
}
