package httpapi

import (
	"errors"
	"net/http"
	"net/url"
	"strings"

	"github.com/Wangjarimm/Fundly/api/internal/auth"
	"github.com/Wangjarimm/Fundly/api/internal/http/apigen"
	"github.com/Wangjarimm/Fundly/api/internal/service"
)

// Body login/daftar dibaca sebagai string biasa (bukan openapi_types.Email)
// agar email yang salah format dijawab 422 dengan pesan yang ramah.
type credentialsBody struct {
	Email       string  `json:"email"`
	Password    string  `json:"password"`
	DisplayName *string `json:"display_name,omitempty"`
}

func (a *api) register(w http.ResponseWriter, r *http.Request) {
	var body credentialsBody
	if !decodeJSON(w, r, &body) {
		return
	}
	name := ""
	if body.DisplayName != nil {
		name = *body.DisplayName
	}
	user, sess, err := a.svc.Register(r.Context(), body.Email, body.Password, name)
	if err != nil {
		a.fail(w, r, err)
		return
	}
	setSessionCookie(w, sess.Token, sess.ExpiresAt)
	writeJSON(w, http.StatusCreated, toUser(user))
}

func (a *api) login(w http.ResponseWriter, r *http.Request) {
	var body credentialsBody
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.DisplayName != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Format data tidak valid.")
		return
	}
	user, sess, err := a.svc.Login(r.Context(), body.Email, body.Password)
	if err != nil {
		a.fail(w, r, err)
		return
	}
	setSessionCookie(w, sess.Token, sess.ExpiresAt)
	writeJSON(w, http.StatusOK, toUser(user))
}

func (a *api) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(auth.SessionCookieName); err == nil {
		if err := a.svc.Logout(r.Context(), c.Value); err != nil {
			a.fail(w, r, err)
			return
		}
	}
	clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

// --- Google OAuth ---

const oauthCookieName = "fundly_oauth"
const oauthCookiePath = "/api/v1/auth/google"

func (a *api) redirectURL(r *http.Request) string {
	base := a.baseURL
	if base == "" {
		scheme := "http"
		if a.trustVercel || r.TLS != nil {
			scheme = "https"
		}
		base = scheme + "://" + r.Host
	}
	return strings.TrimRight(base, "/") + "/api/v1/auth/google/callback"
}

func (a *api) googleStart(w http.ResponseWriter, r *http.Request) {
	if a.google == nil || a.signer == nil {
		writeError(w, http.StatusServiceUnavailable, "google_not_configured", "Masuk dengan Google belum tersedia. Gunakan email dan password.")
		return
	}
	state, err := auth.RandomString(24)
	if err != nil {
		a.fail(w, r, err)
		return
	}
	verifier, err := auth.RandomString(32)
	if err != nil {
		a.fail(w, r, err)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     oauthCookieName,
		Value:    a.signer.Sign(state + "~" + verifier),
		Path:     oauthCookiePath,
		MaxAge:   600,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
	// Tujuan selalu halaman OAuth Google; redirect_uri harus terdaftar di Google.
	http.Redirect(w, r, a.google.AuthCodeURL(state, verifier, a.redirectURL(r)), http.StatusFound) //nolint:gosec // bukan open redirect
}

func (a *api) googleCallback(w http.ResponseWriter, r *http.Request) {
	// Cookie state sekali pakai.
	http.SetCookie(w, &http.Cookie{Name: oauthCookieName, Value: "", Path: oauthCookiePath, MaxAge: -1, HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode})

	failRedirect := func(reason string) {
		http.Redirect(w, r, "/masuk?error="+url.QueryEscape(reason), http.StatusFound)
	}
	if a.google == nil || a.signer == nil {
		failRedirect("google_not_configured")
		return
	}
	q := r.URL.Query()
	if q.Get("error") != "" {
		failRedirect("google_cancelled")
		return
	}
	c, err := r.Cookie(oauthCookieName)
	if err != nil {
		failRedirect("google_state")
		return
	}
	value, ok := a.signer.Verify(c.Value)
	state, verifier, found := strings.Cut(value, "~")
	if !ok || !found || state == "" || q.Get("state") != state || q.Get("code") == "" {
		failRedirect("google_state")
		return
	}
	gu, err := a.google.Exchange(r.Context(), q.Get("code"), verifier, a.redirectURL(r))
	if err != nil {
		a.logger.Warn("google exchange gagal", "err", err)
		failRedirect("google_failed")
		return
	}
	_, sess, err := a.svc.LoginWithGoogle(r.Context(), gu)
	if err != nil {
		var svcErr *service.Error
		if errors.As(err, &svcErr) {
			failRedirect(svcErr.Code)
			return
		}
		a.logger.Error("login google gagal", "err", err)
		failRedirect("google_failed")
		return
	}
	setSessionCookie(w, sess.Token, sess.ExpiresAt)
	http.Redirect(w, r, "/", http.StatusFound)
}

// --- Profil ---

func (a *api) getMe(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, toUser(principalFrom(r.Context()).User))
}

func (a *api) updateMe(w http.ResponseWriter, r *http.Request) {
	var body apigen.UpdateMeRequest
	if !decodeJSON(w, r, &body) {
		return
	}
	in := service.UpdateMeInput{
		DisplayName: body.DisplayName, CurrentPassword: body.CurrentPassword, NewPassword: body.NewPassword,
		BudgetAutoCopy: body.BudgetAutoCopy,
	}
	if body.Theme != nil {
		t := string(*body.Theme)
		in.Theme = &t
	}
	user, err := a.svc.UpdateMe(r.Context(), principalFrom(r.Context()), in)
	if err != nil {
		a.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toUser(user))
}

func (a *api) deleteMe(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Confirm string `json:"confirm"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if err := a.svc.DeleteMe(r.Context(), principalFrom(r.Context()), body.Confirm); err != nil {
		a.fail(w, r, err)
		return
	}
	clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}
