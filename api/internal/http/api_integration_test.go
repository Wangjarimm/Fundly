package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Wangjarimm/Fundly/api/internal/auth"
	"github.com/Wangjarimm/Fundly/api/internal/db"
	"github.com/Wangjarimm/Fundly/api/internal/db/store"
	httpapi "github.com/Wangjarimm/Fundly/api/internal/http"
	"github.com/Wangjarimm/Fundly/api/internal/service"
)

// --- Perangkat tes ---

type env struct {
	t      *testing.T
	srv    *httptest.Server
	pool   *pgxpool.Pool
	google *fakeGoogle
}

var ipCounter atomic.Int64

func newEnv(t *testing.T) *env {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		if os.Getenv("CI") != "" {
			t.Fatal("TEST_DATABASE_URL wajib diatur di CI")
		}
		t.Skip("TEST_DATABASE_URL tidak diatur; lewati tes integrasi")
	}
	ctx := context.Background()
	if _, err := db.Migrate(ctx, url); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	pool, err := db.Open(ctx, url, 4)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)

	signer, _ := auth.NewSigner(strings.Repeat("s", 32))
	fg := &fakeGoogle{}
	h := httpapi.NewRouter(httpapi.Deps{
		Logger:             slog.New(slog.NewTextHandler(io.Discard, nil)),
		Pinger:             store.New(pool),
		Service:            service.New(pool),
		Google:             fg,
		Signer:             signer,
		BaseURL:            "https://fundly.test",
		TrustVercelHeaders: true, // agar tiap klien tes punya IP sendiri untuk rate limit
	})
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return &env{t: t, srv: srv, pool: pool, google: fg}
}

type client struct {
	e      *env
	ip     string
	cookie string
	csrf   bool
}

func (e *env) client() *client {
	n := ipCounter.Add(1)
	return &client{e: e, ip: fmt.Sprintf("10.%d.%d.%d", (n>>16)&255, (n>>8)&255, n&255), csrf: true}
}

type resp struct {
	status int
	body   []byte
	header http.Header
}

func (r resp) json(t *testing.T, v any) {
	t.Helper()
	if err := json.Unmarshal(r.body, v); err != nil {
		t.Fatalf("decode %s: %v", r.body, err)
	}
}

func (r resp) errCode(t *testing.T) string {
	t.Helper()
	var b struct {
		Error struct{ Code, Message string } `json:"error"`
	}
	r.json(t, &b)
	if b.Error.Message == "" {
		t.Fatalf("pesan error kosong: %s", r.body)
	}
	return b.Error.Code
}

func (c *client) do(method, path string, body any) resp {
	c.e.t.Helper()
	var rdr io.Reader
	if body != nil {
		switch b := body.(type) {
		case string:
			rdr = strings.NewReader(b)
		default:
			buf, _ := json.Marshal(b)
			rdr = bytes.NewReader(buf)
		}
	}
	req, _ := http.NewRequestWithContext(context.Background(), method, c.e.srv.URL+path, rdr)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Vercel-Forwarded-For", c.ip)
	if c.csrf {
		req.Header.Set("X-Requested-With", "fundly")
	}
	if c.cookie != "" {
		req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: c.cookie})
	}
	hc := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	res, err := hc.Do(req)
	if err != nil {
		c.e.t.Fatal(err)
	}
	defer func() { _ = res.Body.Close() }()
	b, _ := io.ReadAll(res.Body)
	for _, ck := range res.Cookies() {
		if ck.Name == auth.SessionCookieName {
			c.cookie = ck.Value
			if ck.MaxAge < 0 {
				c.cookie = ""
			}
		}
	}
	return resp{status: res.StatusCode, body: b, header: res.Header}
}

func (c *client) must(status int, method, path string, body any, out any) resp {
	c.e.t.Helper()
	r := c.do(method, path, body)
	if r.status != status {
		c.e.t.Fatalf("%s %s: status %d, want %d; body %s", method, path, r.status, status, r.body)
	}
	if out != nil {
		r.json(c.e.t, out)
	}
	return r
}

var emailCounter atomic.Int64

func uniqueEmail() string {
	return fmt.Sprintf("u%d-%d@contoh.com", time.Now().UnixNano(), emailCounter.Add(1))
}

type userJSON struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Theme       string `json:"theme"`
	HasPassword bool   `json:"has_password"`
	HasGoogle   bool   `json:"has_google"`
}

type walletJSON struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Type           string  `json:"type"`
	Provider       *string `json:"provider"`
	InitialBalance int64   `json:"initial_balance"`
	Balance        int64   `json:"balance"`
	ArchivedAt     *string `json:"archived_at"`
}

type categoryJSON struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Kind     string `json:"kind"`
	Hidden   bool   `json:"hidden"`
	IsSystem bool   `json:"is_system"`
}

type txJSON struct {
	ID         string  `json:"id"`
	WalletID   string  `json:"wallet_id"`
	CategoryID *string `json:"category_id"`
	Kind       string  `json:"kind"`
	Amount     int64   `json:"amount"`
	OccurredOn string  `json:"occurred_on"`
	Merchant   *string `json:"merchant"`
	ClientID   *string `json:"client_id"`
}

type list[T any] struct {
	Items      []T     `json:"items"`
	NextCursor *string `json:"next_cursor"`
}

// registered membuat pengguna baru yang sudah masuk.
func (e *env) registered() (*client, userJSON) {
	c := e.client()
	var u userJSON
	c.must(http.StatusCreated, "POST", "/api/v1/auth/register",
		map[string]any{"email": uniqueEmail(), "password": "rahasia123", "display_name": "Tes"}, &u)
	return c, u
}

func (c *client) wallets() []walletJSON {
	var l list[walletJSON]
	c.must(http.StatusOK, "GET", "/api/v1/wallets?include_archived=true", nil, &l)
	return l.Items
}

func (c *client) categoryByName(name, kind string) categoryJSON {
	var l list[categoryJSON]
	c.must(http.StatusOK, "GET", "/api/v1/categories?include_hidden=true&kind="+kind, nil, &l)
	for _, x := range l.Items {
		if x.Name == name {
			return x
		}
	}
	c.e.t.Fatalf("kategori %s/%s tidak ada", name, kind)
	return categoryJSON{}
}

func today() string { return time.Now().In(service.Jakarta).Format("2006-01-02") }

// --- F-01 Akun dan login ---

func TestAuthRegisterLoginLogout(t *testing.T) {
	e := newEnv(t)
	c := e.client()
	email := uniqueEmail()

	r := c.must(http.StatusCreated, "POST", "/api/v1/auth/register",
		map[string]any{"email": "  " + strings.ToUpper(email) + " ", "password": "rahasia123"}, nil)
	var u userJSON
	r.json(t, &u)
	if u.Email != email || !u.HasPassword || u.HasGoogle || u.Theme != "system" {
		t.Fatalf("user = %+v", u)
	}
	// KP3: cookie HttpOnly, Secure, SameSite=Lax, 30 hari.
	setCookie := r.header.Get("Set-Cookie")
	for _, want := range []string{"HttpOnly", "Secure", "SameSite=Lax", "Path=/"} {
		if !strings.Contains(setCookie, want) {
			t.Errorf("Set-Cookie %q tidak memuat %s", setCookie, want)
		}
	}
	if !strings.Contains(setCookie, "Max-Age=2591") && !strings.Contains(setCookie, "Max-Age=2592000") {
		t.Errorf("Set-Cookie %q tidak berumur ±30 hari", setCookie)
	}

	var me userJSON
	c.must(http.StatusOK, "GET", "/api/v1/me", nil, &me)
	if me.ID != u.ID {
		t.Fatalf("me = %+v", me)
	}

	// F-02 KP4: dompet Tunai otomatis.
	ws := c.wallets()
	if len(ws) != 1 || ws[0].Name != "Tunai" || ws[0].Type != "cash" || ws[0].Balance != 0 {
		t.Fatalf("wallets = %+v", ws)
	}

	// Duplikat, email salah, password pendek.
	other := e.client()
	if code := other.must(http.StatusConflict, "POST", "/api/v1/auth/register", map[string]any{"email": email, "password": "rahasia123"}, nil).errCode(t); code != "email_taken" {
		t.Fatalf("code = %s", code)
	}
	other.must(http.StatusUnprocessableEntity, "POST", "/api/v1/auth/register", map[string]any{"email": "bukan-email", "password": "rahasia123"}, nil)
	other.must(http.StatusUnprocessableEntity, "POST", "/api/v1/auth/register", map[string]any{"email": uniqueEmail(), "password": "pendek"}, nil)
	other.must(http.StatusBadRequest, "POST", "/api/v1/auth/register", `{"email":`, nil)
	other.must(http.StatusBadRequest, "POST", "/api/v1/auth/register", map[string]any{"email": uniqueEmail(), "password": "rahasia123", "admin": true}, nil)

	// KP4: logout menghapus sesi di server.
	oldCookie := c.cookie
	c.must(http.StatusNoContent, "POST", "/api/v1/auth/logout", nil, nil)
	if c.cookie != "" {
		t.Fatal("cookie harus dihapus")
	}
	c.cookie = oldCookie
	c.must(http.StatusUnauthorized, "GET", "/api/v1/me", nil, nil)
	c.cookie = ""

	// Login.
	if code := c.must(http.StatusUnauthorized, "POST", "/api/v1/auth/login", map[string]any{"email": email, "password": "salah12345"}, nil).errCode(t); code != "invalid_credentials" {
		t.Fatalf("code = %s", code)
	}
	c.must(http.StatusUnauthorized, "POST", "/api/v1/auth/login", map[string]any{"email": uniqueEmail(), "password": "rahasia123"}, nil)
	c.must(http.StatusOK, "POST", "/api/v1/auth/login", map[string]any{"email": email, "password": "rahasia123"}, nil)
	c.must(http.StatusOK, "GET", "/api/v1/me", nil, nil)
}

func TestAuthRequiredAndCSRF(t *testing.T) {
	e := newEnv(t)
	anon := e.client()
	for _, p := range []string{"/api/v1/me", "/api/v1/wallets", "/api/v1/categories", "/api/v1/transactions"} {
		if code := anon.must(http.StatusUnauthorized, "GET", p, nil, nil).errCode(t); code != "unauthorized" {
			t.Fatalf("%s code = %s", p, code)
		}
	}
	c, _ := e.registered()
	c.csrf = false
	if code := c.must(http.StatusForbidden, "POST", "/api/v1/wallets", map[string]any{"name": "Bank", "type": "bank"}, nil).errCode(t); code != "csrf_header_missing" {
		t.Fatalf("code = %s", code)
	}
	c.must(http.StatusForbidden, "POST", "/api/v1/auth/login", map[string]any{"email": "a@b.co", "password": "x"}, nil)
	c.must(http.StatusOK, "GET", "/api/v1/wallets", nil, nil) // GET tidak butuh header
}

func TestAuthRateLimit(t *testing.T) {
	e := newEnv(t)
	c := e.client()
	var last int
	for i := 0; i < 11; i++ {
		last = c.do("POST", "/api/v1/auth/login", map[string]any{"email": "x@contoh.com", "password": "salah12345"}).status
	}
	if last != http.StatusTooManyRequests {
		t.Fatalf("percobaan ke-11 = %d, want 429", last)
	}
	// IP lain tidak terdampak.
	e.client().must(http.StatusUnauthorized, "POST", "/api/v1/auth/login", map[string]any{"email": "x@contoh.com", "password": "salah12345"}, nil)
}

func TestSessionSlidingExpiry(t *testing.T) {
	e := newEnv(t)
	c, u := e.registered()
	// Tanpa perpanjangan: tidak ada Set-Cookie baru.
	if r := c.must(http.StatusOK, "GET", "/api/v1/me", nil, nil); r.header.Get("Set-Cookie") != "" {
		t.Fatal("sesi baru tidak perlu diperpanjang")
	}
	// Mundurkan masa berlaku seolah sesi sudah 10 hari tidak diperpanjang.
	if _, err := e.pool.Exec(context.Background(),
		`UPDATE sessions SET expires_at = now() + interval '20 days' WHERE user_id = $1`, u.ID); err != nil {
		t.Fatal(err)
	}
	r := c.must(http.StatusOK, "GET", "/api/v1/me", nil, nil)
	if !strings.Contains(r.header.Get("Set-Cookie"), auth.SessionCookieName) {
		t.Fatal("sesi aktif harus diperpanjang")
	}
	var days float64
	if err := e.pool.QueryRow(context.Background(),
		`SELECT extract(epoch from expires_at - now())/86400 FROM sessions WHERE user_id = $1`, u.ID).Scan(&days); err != nil {
		t.Fatal(err)
	}
	if days < 29.9 {
		t.Fatalf("expires dalam %.1f hari, want ~30", days)
	}
	// Sesi kedaluwarsa ditolak.
	if _, err := e.pool.Exec(context.Background(), `UPDATE sessions SET expires_at = now() - interval '1 second' WHERE user_id = $1`, u.ID); err != nil {
		t.Fatal(err)
	}
	c.must(http.StatusUnauthorized, "GET", "/api/v1/me", nil, nil)
}

func TestUpdateMeAndDeleteAccount(t *testing.T) {
	e := newEnv(t)
	c, u := e.registered()
	// Sesi kedua (perangkat lain).
	other := e.client()
	other.must(http.StatusOK, "POST", "/api/v1/auth/login", map[string]any{"email": u.Email, "password": "rahasia123"}, nil)

	var me userJSON
	c.must(http.StatusOK, "PATCH", "/api/v1/me", map[string]any{"display_name": "Budi", "theme": "dark"}, &me)
	if me.DisplayName != "Budi" || me.Theme != "dark" {
		t.Fatalf("me = %+v", me)
	}
	c.must(http.StatusUnprocessableEntity, "PATCH", "/api/v1/me", map[string]any{"theme": "ungu"}, nil)
	c.must(http.StatusUnprocessableEntity, "PATCH", "/api/v1/me", map[string]any{"new_password": "barubaru123"}, nil)
	c.must(http.StatusUnprocessableEntity, "PATCH", "/api/v1/me", map[string]any{"new_password": "barubaru123", "current_password": "salah"}, nil)
	c.must(http.StatusOK, "PATCH", "/api/v1/me", map[string]any{"new_password": "barubaru123", "current_password": "rahasia123"}, nil)
	// Perangkat lain dikeluarkan, sesi ini tetap.
	other.must(http.StatusUnauthorized, "GET", "/api/v1/me", nil, nil)
	c.must(http.StatusOK, "GET", "/api/v1/me", nil, nil)

	// Hapus akun (F-01 KP5).
	var ws = c.wallets()
	c.must(http.StatusCreated, "POST", "/api/v1/transactions", map[string]any{
		"wallet_id": ws[0].ID, "kind": "expense", "amount": 1000, "occurred_on": today(),
	}, nil)
	c.must(http.StatusUnprocessableEntity, "DELETE", "/api/v1/me", map[string]any{"confirm": "ya"}, nil)
	c.must(http.StatusNoContent, "DELETE", "/api/v1/me", map[string]any{"confirm": "HAPUS"}, nil)
	var n int
	if err := e.pool.QueryRow(context.Background(), `
		SELECT (SELECT count(*) FROM users WHERE id = $1)
		     + (SELECT count(*) FROM wallets WHERE user_id = $1)
		     + (SELECT count(*) FROM transactions WHERE user_id = $1)
		     + (SELECT count(*) FROM sessions WHERE user_id = $1)`, u.ID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("masih ada %d baris milik pengguna yang dihapus", n)
	}
	e.client().must(http.StatusUnauthorized, "POST", "/api/v1/auth/login", map[string]any{"email": u.Email, "password": "barubaru123"}, nil)
}

// --- Google OAuth (dengan penyedia palsu) ---

type fakeGoogle struct {
	user        auth.GoogleUser
	gotVerifier string
}

func (f *fakeGoogle) AuthCodeURL(state, _, redirectURL string) string {
	return "https://accounts.google.test/auth?state=" + url.QueryEscape(state) + "&redirect_uri=" + url.QueryEscape(redirectURL)
}

func (f *fakeGoogle) Exchange(_ context.Context, code, verifier, _ string) (auth.GoogleUser, error) {
	if code != "kode-ok" {
		return auth.GoogleUser{}, fmt.Errorf("kode salah")
	}
	f.gotVerifier = verifier
	return f.user, nil
}

func (c *client) googleLogin(t *testing.T) resp {
	t.Helper()
	req, _ := http.NewRequestWithContext(context.Background(), "GET", c.e.srv.URL+"/api/v1/auth/google", nil)
	req.Header.Set("X-Vercel-Forwarded-For", c.ip)
	hc := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	res, err := hc.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	_ = res.Body.Close()
	if res.StatusCode != http.StatusFound {
		t.Fatalf("start status %d", res.StatusCode)
	}
	loc, _ := url.Parse(res.Header.Get("Location"))
	if got := loc.Query().Get("redirect_uri"); got != "https://fundly.test/api/v1/auth/google/callback" {
		t.Fatalf("redirect_uri = %s", got)
	}
	var stateCookie *http.Cookie
	for _, ck := range res.Cookies() {
		if ck.Name == "fundly_oauth" {
			stateCookie = ck
		}
	}
	if stateCookie == nil || !stateCookie.HttpOnly || !stateCookie.Secure {
		t.Fatalf("cookie state tidak aman: %+v", stateCookie)
	}

	cb, _ := http.NewRequestWithContext(context.Background(), "GET",
		c.e.srv.URL+"/api/v1/auth/google/callback?code=kode-ok&state="+url.QueryEscape(loc.Query().Get("state")), nil)
	cb.Header.Set("X-Vercel-Forwarded-For", c.ip)
	cb.AddCookie(&http.Cookie{Name: "fundly_oauth", Value: stateCookie.Value})
	res2, err := hc.Do(cb)
	if err != nil {
		t.Fatal(err)
	}
	_ = res2.Body.Close()
	for _, ck := range res2.Cookies() {
		if ck.Name == auth.SessionCookieName {
			c.cookie = ck.Value
		}
	}
	return resp{status: res2.StatusCode, header: res2.Header}
}

func TestGoogleLogin(t *testing.T) {
	e := newEnv(t)

	// Pengguna baru lewat Google.
	email := uniqueEmail()
	e.google.user = auth.GoogleUser{Sub: "sub-" + email, Email: email, EmailVerified: true, Name: "Siti"}
	c := e.client()
	r := c.googleLogin(t)
	if r.status != http.StatusFound || r.header.Get("Location") != "/" {
		t.Fatalf("callback: %d %s", r.status, r.header.Get("Location"))
	}
	if e.google.gotVerifier == "" {
		t.Fatal("PKCE verifier harus diteruskan")
	}
	var me userJSON
	c.must(http.StatusOK, "GET", "/api/v1/me", nil, &me)
	if !me.HasGoogle || me.HasPassword || me.DisplayName != "Siti" || me.Email != email {
		t.Fatalf("me = %+v", me)
	}
	if ws := c.wallets(); len(ws) != 1 || ws[0].Name != "Tunai" {
		t.Fatalf("wallets = %+v", ws)
	}
	// Masuk lagi: pengguna yang sama.
	c2 := e.client()
	c2.googleLogin(t)
	var me2 userJSON
	c2.must(http.StatusOK, "GET", "/api/v1/me", nil, &me2)
	if me2.ID != me.ID {
		t.Fatal("login Google kedua harus ke akun yang sama")
	}

	// Akun email yang sudah ada ditautkan; password lama tidak berlaku lagi.
	pc, pu := e.registered()
	_ = pc
	e.google.user = auth.GoogleUser{Sub: "sub-" + pu.Email, Email: pu.Email, EmailVerified: true}
	g := e.client()
	g.googleLogin(t)
	var linked userJSON
	g.must(http.StatusOK, "GET", "/api/v1/me", nil, &linked)
	if linked.ID != pu.ID || !linked.HasGoogle || linked.HasPassword {
		t.Fatalf("linked = %+v", linked)
	}
	e.client().must(http.StatusUnauthorized, "POST", "/api/v1/auth/login", map[string]any{"email": pu.Email, "password": "rahasia123"}, nil)

	// Email belum terverifikasi ditolak.
	e.google.user = auth.GoogleUser{Sub: "sub-x", Email: uniqueEmail(), EmailVerified: false}
	bad := e.client()
	r = bad.googleLogin(t)
	if !strings.Contains(r.header.Get("Location"), "error=google_email_unverified") || bad.cookie != "" {
		t.Fatalf("unverified: %s", r.header.Get("Location"))
	}

	// State palsu ditolak.
	hc := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	req, _ := http.NewRequestWithContext(context.Background(), "GET", e.srv.URL+"/api/v1/auth/google/callback?code=kode-ok&state=palsu", nil)
	req.AddCookie(&http.Cookie{Name: "fundly_oauth", Value: "palsu.tanda"})
	res, err := hc.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	_ = res.Body.Close()
	if !strings.Contains(res.Header.Get("Location"), "error=google_state") {
		t.Fatalf("state palsu: %s", res.Header.Get("Location"))
	}
}

// --- F-02 Dompet ---

func TestWallets(t *testing.T) {
	e := newEnv(t)
	c, _ := e.registered()

	var w walletJSON
	c.must(http.StatusCreated, "POST", "/api/v1/wallets", map[string]any{
		"name": " GoPay ", "type": "ewallet", "provider": "GoPay", "initial_balance": 150000,
	}, &w)
	if w.Name != "GoPay" || w.Provider == nil || *w.Provider != "GoPay" || w.Balance != 150000 {
		t.Fatalf("wallet = %+v", w)
	}
	c.must(http.StatusUnprocessableEntity, "POST", "/api/v1/wallets", map[string]any{"name": "", "type": "bank"}, nil)
	c.must(http.StatusUnprocessableEntity, "POST", "/api/v1/wallets", map[string]any{"name": "X", "type": "kripto"}, nil)

	// Saldo = awal + masuk − keluar (KP3).
	c.must(http.StatusCreated, "POST", "/api/v1/transactions", map[string]any{"wallet_id": w.ID, "kind": "expense", "amount": 25000, "occurred_on": today()}, nil)
	c.must(http.StatusCreated, "POST", "/api/v1/transactions", map[string]any{"wallet_id": w.ID, "kind": "income", "amount": 50000, "occurred_on": today()}, nil)
	for _, x := range c.wallets() {
		if x.ID == w.ID && x.Balance != 175000 {
			t.Fatalf("balance = %d, want 175000", x.Balance)
		}
	}

	// Ubah, hapus provider, arsipkan.
	var up walletJSON
	c.must(http.StatusOK, "PATCH", "/api/v1/wallets/"+w.ID, map[string]any{"name": "GoPay Utama", "provider": nil, "archived": true}, &up)
	if up.Name != "GoPay Utama" || up.Provider != nil || up.ArchivedAt == nil || up.Balance != 175000 {
		t.Fatalf("updated = %+v", up)
	}
	var active list[walletJSON]
	c.must(http.StatusOK, "GET", "/api/v1/wallets", nil, &active)
	if len(active.Items) != 1 {
		t.Fatalf("dompet aktif = %d, want 1 (Tunai)", len(active.Items))
	}
	// Transaksi baru ke dompet terarsip ditolak.
	c.must(http.StatusUnprocessableEntity, "POST", "/api/v1/transactions", map[string]any{"wallet_id": w.ID, "kind": "expense", "amount": 1, "occurred_on": today()}, nil)
	c.must(http.StatusOK, "PATCH", "/api/v1/wallets/"+w.ID, map[string]any{"archived": false}, &up)
	if up.ArchivedAt != nil {
		t.Fatal("dompet harus aktif lagi")
	}
	c.must(http.StatusNotFound, "PATCH", "/api/v1/wallets/bukan-uuid", map[string]any{"name": "x"}, nil)
}

// --- F-03 Transaksi ---

func TestTransactionsCRUDIdempotencyAndUndo(t *testing.T) {
	e := newEnv(t)
	c, _ := e.registered()
	wallet := c.wallets()[0]
	makanan := c.categoryByName("Makanan", "expense")
	gaji := c.categoryByName("Gaji", "income")

	var tx txJSON
	c.must(http.StatusCreated, "POST", "/api/v1/transactions", map[string]any{
		"wallet_id": wallet.ID, "kind": "expense", "amount": 87500, "occurred_on": today(),
		"category_id": makanan.ID, "merchant": "Warung Bu Tini", "note": "makan siang",
	}, &tx)
	if tx.Amount != 87500 || tx.CategoryID == nil || *tx.CategoryID != makanan.ID || tx.OccurredOn != today() {
		t.Fatalf("tx = %+v", tx)
	}

	// Validasi.
	for name, body := range map[string]map[string]any{
		"jumlah 0":         {"wallet_id": wallet.ID, "kind": "expense", "amount": 0, "occurred_on": today()},
		"jumlah negatif":   {"wallet_id": wallet.ID, "kind": "expense", "amount": -5, "occurred_on": today()},
		"kategori beda":    {"wallet_id": wallet.ID, "kind": "expense", "amount": 1, "occurred_on": today(), "category_id": gaji.ID},
		"tanggal jauh":     {"wallet_id": wallet.ID, "kind": "expense", "amount": 1, "occurred_on": "1999-01-01"},
		"dompet tidak ada": {"wallet_id": "00000000-0000-0000-0000-000000000000", "kind": "expense", "amount": 1, "occurred_on": today()},
	} {
		if r := c.do("POST", "/api/v1/transactions", body); r.status != http.StatusUnprocessableEntity {
			t.Errorf("%s: status %d body %s", name, r.status, r.body)
		}
	}
	c.must(http.StatusBadRequest, "POST", "/api/v1/transactions", map[string]any{"wallet_id": wallet.ID, "kind": "expense", "amount": 1.5, "occurred_on": today()}, nil)

	// Idempoten lewat client_id (F-07 KP4).
	clientID := "4f8c7e8a-1b2c-4d5e-8f90-123456789abc"
	body := map[string]any{"wallet_id": wallet.ID, "kind": "expense", "amount": 12000, "occurred_on": today(), "client_id": clientID}
	var a, b txJSON
	c.must(http.StatusCreated, "POST", "/api/v1/transactions", body, &a)
	c.must(http.StatusOK, "POST", "/api/v1/transactions", body, &b)
	if a.ID != b.ID || b.ClientID == nil || *b.ClientID != clientID {
		t.Fatalf("idempotensi gagal: %+v vs %+v", a, b)
	}

	// Ubah: kosongkan kategori, ganti jumlah.
	var up txJSON
	c.must(http.StatusOK, "PATCH", "/api/v1/transactions/"+tx.ID, map[string]any{"amount": 90000, "category_id": nil}, &up)
	if up.Amount != 90000 || up.CategoryID != nil || up.Merchant == nil || *up.Merchant != "Warung Bu Tini" {
		t.Fatalf("updated = %+v", up)
	}
	// Ganti jenis tanpa kategori baru: kategori lama dilepas.
	c.must(http.StatusOK, "PATCH", "/api/v1/transactions/"+tx.ID, map[string]any{"category_id": makanan.ID}, &up)
	c.must(http.StatusOK, "PATCH", "/api/v1/transactions/"+tx.ID, map[string]any{"kind": "income"}, &up)
	if up.Kind != "income" || up.CategoryID != nil {
		t.Fatalf("ganti jenis = %+v", up)
	}

	// Hapus lalu batalkan (KP5).
	c.must(http.StatusNoContent, "DELETE", "/api/v1/transactions/"+tx.ID, nil, nil)
	c.must(http.StatusNotFound, "GET", "/api/v1/transactions/"+tx.ID, nil, nil)
	c.must(http.StatusNotFound, "DELETE", "/api/v1/transactions/"+tx.ID, nil, nil)
	if bal := c.wallets()[0].Balance; bal != -12000 {
		t.Fatalf("saldo setelah hapus = %d, want -12000", bal)
	}
	c.must(http.StatusOK, "POST", "/api/v1/transactions/"+tx.ID+"/restore", nil, nil)
	c.must(http.StatusOK, "GET", "/api/v1/transactions/"+tx.ID, nil, nil)
	c.must(http.StatusNotFound, "POST", "/api/v1/transactions/"+tx.ID+"/restore", nil, nil)
}

func TestTransactionsListFiltersAndCursor(t *testing.T) {
	e := newEnv(t)
	c, _ := e.registered()
	wallet := c.wallets()[0]
	var bank walletJSON
	c.must(http.StatusCreated, "POST", "/api/v1/wallets", map[string]any{"name": "Bank", "type": "bank"}, &bank)
	month := time.Now().In(service.Jakarta).Format("2006-01")

	merchants := []string{"Indomaret", "Alfamart", "Diskon 50%", "Warung_Kopi", "Gojek", "Grab", "Kopi Kenangan"}
	for i, m := range merchants {
		w := wallet.ID
		if i%2 == 1 {
			w = bank.ID
		}
		day := fmt.Sprintf("%s-%02d", month, 1+i%3)
		c.must(http.StatusCreated, "POST", "/api/v1/transactions", map[string]any{
			"wallet_id": w, "kind": "expense", "amount": 1000 * (i + 1), "occurred_on": day, "merchant": m,
		}, nil)
	}
	c.must(http.StatusCreated, "POST", "/api/v1/transactions", map[string]any{
		"wallet_id": wallet.ID, "kind": "income", "amount": 5000000, "occurred_on": month + "-01", "merchant": "Gaji",
	}, nil)
	// Bulan lain tidak ikut.
	prev := time.Now().In(service.Jakarta).AddDate(0, -1, 0).Format("2006-01") + "-15"
	c.must(http.StatusCreated, "POST", "/api/v1/transactions", map[string]any{
		"wallet_id": wallet.ID, "kind": "expense", "amount": 1, "occurred_on": prev,
	}, nil)

	// Kursor: telusuri semua halaman tanpa duplikat, urutan menurun.
	seen := map[string]bool{}
	cursor := ""
	pages := 0
	lastDate := "9999"
	for {
		var page list[txJSON]
		path := "/api/v1/transactions?month=" + month + "&limit=3"
		if cursor != "" {
			path += "&cursor=" + url.QueryEscape(cursor)
		}
		c.must(http.StatusOK, "GET", path, nil, &page)
		pages++
		for _, x := range page.Items {
			if seen[x.ID] {
				t.Fatalf("duplikat %s", x.ID)
			}
			if x.OccurredOn > lastDate {
				t.Fatalf("urutan salah: %s setelah %s", x.OccurredOn, lastDate)
			}
			lastDate = x.OccurredOn
			seen[x.ID] = true
		}
		if page.NextCursor == nil {
			break
		}
		cursor = *page.NextCursor
	}
	if len(seen) != 8 || pages != 3 {
		t.Fatalf("seen=%d pages=%d, want 8/3", len(seen), pages)
	}

	count := func(q string) int {
		var page list[txJSON]
		c.must(http.StatusOK, "GET", "/api/v1/transactions?month="+month+"&limit=100"+q, nil, &page)
		return len(page.Items)
	}
	if n := count("&kind=income"); n != 1 {
		t.Errorf("kind=income: %d", n)
	}
	if n := count("&wallet_id=" + bank.ID); n != 3 {
		t.Errorf("wallet bank: %d", n)
	}
	if n := count("&q=kopi"); n != 2 {
		t.Errorf("q=kopi: %d", n)
	}
	if n := count("&q=" + url.QueryEscape("%")); n != 1 {
		t.Errorf("q=%%: %d (wildcard harus di-escape)", n)
	}
	if n := count("&q=" + url.QueryEscape("_")); n != 1 {
		t.Errorf("q=_: %d (wildcard harus di-escape)", n)
	}
	c.must(http.StatusBadRequest, "GET", "/api/v1/transactions?month=2026-13", nil, nil)
	c.must(http.StatusBadRequest, "GET", "/api/v1/transactions?cursor=rusak", nil, nil)
	c.must(http.StatusBadRequest, "GET", "/api/v1/transactions?limit=500", nil, nil)
	c.must(http.StatusBadRequest, "GET", "/api/v1/transactions?wallet_id=x", nil, nil)
}

// --- F-04 Kategori dan kategori otomatis ---

type suggestJSON struct {
	CategoryID *string `json:"category_id"`
	Confidence float64 `json:"confidence"`
}

func TestCategoriesAndSuggestions(t *testing.T) {
	e := newEnv(t)
	c, _ := e.registered()
	belanja := c.categoryByName("Belanja", "expense")
	makanan := c.categoryByName("Makanan", "expense")

	// Kategori bawaan lengkap (Lampiran A).
	var all list[categoryJSON]
	c.must(http.StatusOK, "GET", "/api/v1/categories", nil, &all)
	if len(all.Items) != 16 {
		t.Fatalf("kategori bawaan = %d, want 16", len(all.Items))
	}

	// Saran dari aturan bawaan (KP2, KP5).
	var s suggestJSON
	c.must(http.StatusOK, "POST", "/api/v1/categories/suggest", map[string]any{"merchant": "INDOMARET, Jl. Sudirman"}, &s)
	if s.CategoryID == nil || *s.CategoryID != belanja.ID || s.Confidence != 0.8 {
		t.Fatalf("suggest = %+v", s)
	}
	c.must(http.StatusOK, "POST", "/api/v1/categories/suggest", map[string]any{"merchant": "Toko Pak Budi", "note": "beli kopi"}, &s)
	if s.CategoryID == nil || *s.CategoryID != makanan.ID {
		t.Fatalf("saran dari catatan = %+v", s)
	}
	c.must(http.StatusOK, "POST", "/api/v1/categories/suggest", map[string]any{"merchant": "Toko Pak Budi"}, &s)
	if s.CategoryID != nil || s.Confidence != 0 {
		t.Fatalf("tanpa kecocokan = %+v", s)
	}

	// Koreksi pengguna jadi aturan pribadi (KP3).
	wallet := c.wallets()[0]
	c.must(http.StatusCreated, "POST", "/api/v1/transactions", map[string]any{
		"wallet_id": wallet.ID, "kind": "expense", "amount": 30000, "occurred_on": today(),
		"merchant": "Kopi Kenangan", "category_id": belanja.ID,
	}, nil)
	c.must(http.StatusOK, "POST", "/api/v1/categories/suggest", map[string]any{"merchant": "kopi kenangan!!"}, &s)
	if s.CategoryID == nil || *s.CategoryID != belanja.ID || s.Confidence != 1.0 {
		t.Fatalf("aturan pribadi = %+v", s)
	}
	// Koreksi lagi lewat ubah transaksi → aturan pribadi diperbarui.
	var page list[txJSON]
	c.must(http.StatusOK, "GET", "/api/v1/transactions?q=kenangan", nil, &page)
	c.must(http.StatusOK, "PATCH", "/api/v1/transactions/"+page.Items[0].ID, map[string]any{"category_id": makanan.ID}, nil)
	c.must(http.StatusOK, "POST", "/api/v1/categories/suggest", map[string]any{"merchant": "Kopi Kenangan"}, &s)
	if s.CategoryID == nil || *s.CategoryID != makanan.ID {
		t.Fatalf("aturan pribadi diperbarui = %+v", s)
	}

	// Kategori milik pengguna.
	var mine categoryJSON
	c.must(http.StatusCreated, "POST", "/api/v1/categories", map[string]any{"name": "Kucing", "kind": "expense"}, &mine)
	if mine.IsSystem || mine.Name != "Kucing" {
		t.Fatalf("mine = %+v", mine)
	}
	c.must(http.StatusOK, "PATCH", "/api/v1/categories/"+mine.ID, map[string]any{"name": "Kucing Oren"}, &mine)
	if mine.Name != "Kucing Oren" {
		t.Fatalf("rename = %+v", mine)
	}

	// Bawaan tidak bisa diganti nama, tapi bisa disembunyikan per pengguna.
	if code := c.must(http.StatusForbidden, "PATCH", "/api/v1/categories/"+belanja.ID, map[string]any{"name": "Shopping"}, nil).errCode(t); code != "system_category" {
		t.Fatalf("code = %s", code)
	}
	var hidden categoryJSON
	c.must(http.StatusOK, "PATCH", "/api/v1/categories/"+belanja.ID, map[string]any{"hidden": true}, &hidden)
	if !hidden.Hidden || !hidden.IsSystem {
		t.Fatalf("hidden = %+v", hidden)
	}
	c.must(http.StatusOK, "GET", "/api/v1/categories?kind=expense", nil, &all)
	for _, x := range all.Items {
		if x.ID == belanja.ID {
			t.Fatal("kategori tersembunyi tidak boleh muncul tanpa include_hidden")
		}
	}
	// Pengguna lain tidak terdampak.
	other, _ := e.registered()
	if other.categoryByName("Belanja", "expense").Hidden {
		t.Fatal("menyembunyikan kategori bawaan tidak boleh berdampak ke pengguna lain")
	}
}

// --- Isolasi antarpengguna (PRD bagian 13) ---

func TestUserIsolation(t *testing.T) {
	e := newEnv(t)
	alice, _ := e.registered()
	bob, _ := e.registered()

	aWallet := alice.wallets()[0]
	var aCat categoryJSON
	alice.must(http.StatusCreated, "POST", "/api/v1/categories", map[string]any{"name": "Rahasia Alice", "kind": "expense"}, &aCat)
	var aTx txJSON
	alice.must(http.StatusCreated, "POST", "/api/v1/transactions", map[string]any{
		"wallet_id": aWallet.ID, "kind": "expense", "amount": 777, "occurred_on": today(),
		"category_id": aCat.ID, "merchant": "Toko Alice", "client_id": "11111111-2222-4333-8444-555555555555",
	}, &aTx)
	alice.must(http.StatusNoContent, "DELETE", "/api/v1/transactions/"+aTx.ID, nil, nil)
	alice.must(http.StatusOK, "POST", "/api/v1/transactions/"+aTx.ID+"/restore", nil, nil)

	// Bob tidak bisa membaca atau mengubah data Alice.
	bob.must(http.StatusNotFound, "GET", "/api/v1/transactions/"+aTx.ID, nil, nil)
	bob.must(http.StatusNotFound, "PATCH", "/api/v1/transactions/"+aTx.ID, map[string]any{"amount": 1}, nil)
	bob.must(http.StatusNotFound, "DELETE", "/api/v1/transactions/"+aTx.ID, nil, nil)
	bob.must(http.StatusNotFound, "POST", "/api/v1/transactions/"+aTx.ID+"/restore", nil, nil)
	bob.must(http.StatusNotFound, "PATCH", "/api/v1/wallets/"+aWallet.ID, map[string]any{"name": "punya bob"}, nil)
	bob.must(http.StatusNotFound, "PATCH", "/api/v1/categories/"+aCat.ID, map[string]any{"name": "punya bob"}, nil)

	bobWallet := bob.wallets()[0]
	bob.must(http.StatusUnprocessableEntity, "POST", "/api/v1/transactions", map[string]any{
		"wallet_id": aWallet.ID, "kind": "expense", "amount": 1, "occurred_on": today(),
	}, nil)
	bob.must(http.StatusUnprocessableEntity, "POST", "/api/v1/transactions", map[string]any{
		"wallet_id": bobWallet.ID, "kind": "expense", "amount": 1, "occurred_on": today(), "category_id": aCat.ID,
	}, nil)

	// client_id yang sama milik pengguna berbeda tidak bentrok.
	var bTx txJSON
	bob.must(http.StatusCreated, "POST", "/api/v1/transactions", map[string]any{
		"wallet_id": bobWallet.ID, "kind": "expense", "amount": 5, "occurred_on": today(),
		"client_id": "11111111-2222-4333-8444-555555555555",
	}, &bTx)
	if bTx.ID == aTx.ID {
		t.Fatal("client_id pengguna lain tidak boleh mengembalikan transaksi Alice")
	}

	// Daftar Bob tidak memuat apa pun milik Alice.
	var txs list[txJSON]
	bob.must(http.StatusOK, "GET", "/api/v1/transactions?limit=100&q=Alice", nil, &txs)
	if len(txs.Items) != 0 {
		t.Fatal("transaksi Alice bocor ke Bob")
	}
	for _, w := range bob.wallets() {
		if w.ID == aWallet.ID {
			t.Fatal("dompet Alice bocor ke Bob")
		}
	}
	var cats list[categoryJSON]
	bob.must(http.StatusOK, "GET", "/api/v1/categories?include_hidden=true", nil, &cats)
	for _, x := range cats.Items {
		if x.ID == aCat.ID {
			t.Fatal("kategori Alice bocor ke Bob")
		}
	}
	// Aturan pribadi Alice tidak memengaruhi saran untuk Bob.
	var s suggestJSON
	bob.must(http.StatusOK, "POST", "/api/v1/categories/suggest", map[string]any{"merchant": "Toko Alice"}, &s)
	if s.CategoryID != nil {
		t.Fatalf("aturan pribadi Alice bocor ke Bob: %+v", s)
	}
	// Saldo Alice tidak berubah oleh aksi Bob.
	if bal := alice.wallets()[0].Balance; bal != -777 {
		t.Fatalf("saldo Alice = %d", bal)
	}
}
