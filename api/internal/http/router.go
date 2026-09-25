package httpapi

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/httprate"

	"github.com/Wangjarimm/Fundly/api/internal/auth"
	"github.com/Wangjarimm/Fundly/api/internal/service"
)

// Deps adalah dependensi yang dibutuhkan router.
type Deps struct {
	Logger *slog.Logger
	Pinger Pinger
	// Service boleh nil (mis. di tes healthz); rute data hanya dipasang bila ada.
	Service *service.Service
	// Google nil bila GOOGLE_CLIENT_ID/SECRET belum diatur.
	Google auth.GoogleProvider
	Signer *auth.Signer
	// BaseURL opsional (APP_BASE_URL) untuk membentuk redirect OAuth.
	BaseURL string
	// TrustVercelHeaders true bila berjalan di Vercel (env VERCEL=1),
	// sehingga IP klien diambil dari header yang ditulis edge Vercel.
	TrustVercelHeaders bool
}

type api struct {
	logger      *slog.Logger
	svc         *service.Service
	google      auth.GoogleProvider
	signer      *auth.Signer
	baseURL     string
	trustVercel bool
}

// NewRouter membangun seluruh router aplikasi di bawah /api/v1.
// Satu router dipakai baik lokal (go run) maupun di Vercel (D-02, D-09).
func NewRouter(d Deps) http.Handler {
	clientIP := clientIPFunc(d.TrustVercelHeaders)
	a := &api{
		logger: d.Logger, svc: d.Service, google: d.Google, signer: d.Signer,
		baseURL: d.BaseURL, trustVercel: d.TrustVercelHeaders,
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(requestLogger(d.Logger))
	r.Use(middleware.Recoverer)
	r.Use(securityHeaders)

	r.NotFound(func(w http.ResponseWriter, _ *http.Request) {
		writeError(w, http.StatusNotFound, "not_found", "Alamat tidak ditemukan.")
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, _ *http.Request) {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Metode tidak didukung.")
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.With(rateLimit(30, time.Minute, clientIP)).Get("/healthz", healthz(d.Pinger, d.Logger))

		if a.svc == nil {
			return
		}
		r.Group(func(r chi.Router) { a.mountDataRoutes(r, clientIP) })
	})

	return r
}

// rateLimit membatasi laju per IP klien. Penghitung ada di memori instance;
// cukup sebagai lapisan dasar untuk fungsi serverless.
func rateLimit(limit int, window time.Duration, clientIP func(*http.Request) string) func(http.Handler) http.Handler {
	return httprate.LimitBy(limit, window,
		func(r *http.Request) (string, error) { return clientIP(r), nil },
		httprate.WithLimitHandler(func(w http.ResponseWriter, _ *http.Request) {
			writeError(w, http.StatusTooManyRequests, "rate_limited", "Terlalu banyak permintaan. Coba lagi sebentar lagi.")
		}),
	)
}

func requestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)
			logger.Info("request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", ww.Status(),
				"duration_ms", time.Since(start).Milliseconds(),
				"request_id", middleware.GetReqID(r.Context()),
			)
		})
	}
}
