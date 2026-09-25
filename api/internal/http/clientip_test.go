package httpapi

import (
	"net/http/httptest"
	"testing"
)

func TestClientIP(t *testing.T) {
	tests := []struct {
		name        string
		trustVercel bool
		header      string
		want        string
	}{
		{"lokal abaikan header palsu", false, "1.2.3.4", "192.0.2.1"},
		{"vercel pakai header", true, "203.0.113.7, 10.0.0.1", "203.0.113.7"},
		{"vercel header rusak jatuh ke RemoteAddr", true, "bukan-ip", "192.0.2.1"},
		{"vercel tanpa header", true, "", "192.0.2.1"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/", nil) // RemoteAddr = 192.0.2.1:1234
			if tt.header != "" {
				r.Header.Set("X-Vercel-Forwarded-For", tt.header)
			}
			if got := clientIPFunc(tt.trustVercel)(r); got != tt.want {
				t.Fatalf("got %q, want %q", got, tt.want)
			}
		})
	}
}
