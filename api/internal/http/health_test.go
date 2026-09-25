package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

type fakePinger struct{ err error }

func (f fakePinger) Ping(context.Context) (int32, error) {
	if f.err != nil {
		return 0, f.err
	}
	return 1, nil
}

func newTestRouter(p Pinger) http.Handler {
	return NewRouter(Deps{Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Pinger: p})
}

func TestHealthzOK(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestRouter(fakePinger{}).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/healthz", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["status"] != "ok" || body["db"] != "ok" {
		t.Fatalf("body = %v", body)
	}
	if got := rec.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("Cache-Control = %q", got)
	}
}

func TestHealthzDBDown(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestRouter(fakePinger{err: errors.New("down")}).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/healthz", nil))

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
	var body errorBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Error.Code != "db_unavailable" || body.Error.Message == "" {
		t.Fatalf("body = %+v", body)
	}
}

func TestHealthzRateLimited(t *testing.T) {
	h := newTestRouter(fakePinger{})
	var last int
	for i := 0; i < 31; i++ {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/healthz", nil))
		last = rec.Code
	}
	if last != http.StatusTooManyRequests {
		t.Fatalf("permintaan ke-31 status = %d, want 429", last)
	}
}

func TestNotFoundUsesErrorFormat(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestRouter(fakePinger{}).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/tidak-ada", nil))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
	var body errorBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Error.Code != "not_found" {
		t.Fatalf("code = %q", body.Error.Code)
	}
}
