// Command server adalah entry point backend Fundly.
// Dipakai lokal (go run ./cmd/server) dan di Vercel (Go runtime, mode server):
// membaca PORT dari environment lalu menjalankan seluruh router chi (D-09).
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/Wangjarimm/Fundly/api/internal/db"
	"github.com/Wangjarimm/Fundly/api/internal/db/store"
	httpapi "github.com/Wangjarimm/Fundly/api/internal/http"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("server berhenti", "err", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return errors.New("DATABASE_URL belum diatur")
	}
	maxConns := int32(3)
	if v, err := strconv.ParseInt(os.Getenv("DB_MAX_CONNS"), 10, 32); err == nil && v > 0 {
		maxConns = int32(v)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Pool dibuat sekali per instance dan dipakai ulang selama instance "hangat".
	pool, err := db.Open(ctx, dbURL, maxConns)
	if err != nil {
		return err
	}
	defer pool.Close()

	handler := httpapi.NewRouter(httpapi.Deps{
		Logger:             logger,
		Pinger:             store.New(pool),
		TrustVercelHeaders: os.Getenv("VERCEL") == "1",
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info("server mendengarkan", "port", port)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	}
}
