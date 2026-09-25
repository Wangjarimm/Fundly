package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"time"
)

// Pinger dipenuhi oleh *store.Queries (query sqlc "Ping" = SELECT 1).
type Pinger interface {
	Ping(ctx context.Context) (int32, error)
}

// healthz menjalankan SELECT 1 ke database. Respons sengaja minimal.
// Dipanggil juga oleh keepalive.yml agar proyek Supabase tidak dijeda (D-15).
func healthz(p Pinger, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		w.Header().Set("Cache-Control", "no-store")
		if _, err := p.Ping(ctx); err != nil {
			logger.Error("healthz: database tidak bisa dihubungi", "err", err)
			writeError(w, http.StatusServiceUnavailable, "db_unavailable", "Database belum bisa dihubungi. Coba lagi sebentar lagi.")
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "db": "ok"})
	}
}
