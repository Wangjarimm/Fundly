package httpapi

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/Wangjarimm/Fundly/api/internal/auth"
	"github.com/Wangjarimm/Fundly/api/internal/service"
)

// securityHeaders menambahkan header keamanan untuk semua respons API.
// CSP untuk halaman frontend diatur terpisah di vercel.json (M5).
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
		next.ServeHTTP(w, r)
	})
}

// CSRFHeader adalah header wajib pada permintaan yang mengubah data.
const (
	CSRFHeader = "X-Requested-With"
	CSRFValue  = "fundly"
)

// requireCSRFHeader menolak POST/PUT/PATCH/DELETE tanpa header khusus.
// Form lintas situs tidak bisa menambahkan header ini, dan fetch lintas situs
// dengan header kustom memicu preflight CORS yang tidak kita izinkan.
func requireCSRFHeader(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
		default:
			if r.Header.Get(CSRFHeader) != CSRFValue {
				writeError(w, http.StatusForbidden, "csrf_header_missing", "Permintaan ditolak. Muat ulang halaman lalu coba lagi.")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

type principalKey struct{}

func principalFrom(ctx context.Context) service.Principal {
	p, _ := ctx.Value(principalKey{}).(service.Principal)
	return p
}

func setSessionCookie(w http.ResponseWriter, token string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     auth.SessionCookieName,
		Value:    token,
		Path:     "/",
		Expires:  expires,
		MaxAge:   int(time.Until(expires).Seconds()),
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}

func clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name: auth.SessionCookieName, Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	})
}

// requireAuth memuat pengguna dari cookie sesi, atau menjawab 401.
func (a *api) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(auth.SessionCookieName)
		if err != nil {
			a.fail(w, r, service.ErrUnauthorized)
			return
		}
		p, refreshed, err := a.svc.Authenticate(r.Context(), c.Value)
		if err != nil {
			if errors.Is(err, service.ErrUnauthorized) {
				clearSessionCookie(w)
			}
			a.fail(w, r, err)
			return
		}
		if refreshed != nil {
			setSessionCookie(w, refreshed.Token, refreshed.ExpiresAt)
		}
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), principalKey{}, p)))
	})
}
