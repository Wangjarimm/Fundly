// Package service berisi logika bisnis Fundly. Setiap fungsi yang menyentuh
// data pengguna menerima userID dari sesi dan meneruskannya ke query sqlc.
package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"
	_ "time/tzdata" // zona Asia/Jakarta tersedia walau OS tanpa tzdata

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Wangjarimm/Fundly/api/internal/db/store"
)

// Jakarta adalah zona waktu default pengguna (PRD bagian 8).
var Jakarta = mustLoadLocation("Asia/Jakarta")

func mustLoadLocation(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return loc
}

// Error adalah kesalahan yang aman ditampilkan ke pengguna.
type Error struct {
	Status  int
	Code    string
	Message string
}

func (e *Error) Error() string { return fmt.Sprintf("%s: %s", e.Code, e.Message) }

func newErr(status int, code, msg string) *Error {
	return &Error{Status: status, Code: code, Message: msg}
}

// Kesalahan umum.
var (
	ErrNotFound     = newErr(http.StatusNotFound, "not_found", "Data tidak ditemukan.")
	ErrUnauthorized = newErr(http.StatusUnauthorized, "unauthorized", "Silakan masuk terlebih dahulu.")
)

func invalid(msg string) *Error {
	return newErr(http.StatusUnprocessableEntity, "validation_failed", msg)
}

// Service menyatukan akses database untuk semua domain.
type Service struct {
	pool *pgxpool.Pool
	q    *store.Queries
	now  func() time.Time
}

// New membuat Service.
func New(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: store.New(pool), now: time.Now}
}

// inTx menjalankan fn dalam satu transaksi database.
func (s *Service) inTx(ctx context.Context, fn func(q *store.Queries) error) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := fn(s.q.WithTx(tx)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func isNoRows(err error) bool { return errors.Is(err, pgx.ErrNoRows) }

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// Today mengembalikan tanggal hari ini di zona Jakarta (tengah malam UTC,
// sesuai representasi kolom DATE di pgx).
func (s *Service) Today() time.Time {
	y, m, d := s.now().In(Jakarta).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// MonthRange mengubah "YYYY-MM" (atau kosong = bulan ini) menjadi [awal, akhir).
func (s *Service) MonthRange(month string) (start, end time.Time, err error) {
	if month == "" {
		t := s.Today()
		start = time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
	} else {
		start, err = time.Parse("2006-01", month)
		if err != nil {
			return time.Time{}, time.Time{}, newErr(http.StatusBadRequest, "invalid_month", "Format bulan harus YYYY-MM.")
		}
	}
	return start, start.AddDate(0, 1, 0), nil
}
