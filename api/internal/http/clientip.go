package httpapi

import (
	"net"
	"net/http"
	"strings"
)

// clientIPFunc mengembalikan fungsi untuk menentukan IP klien.
//
// Header seperti X-Forwarded-For bisa dipalsukan klien, jadi hanya dipercaya
// bila berjalan di belakang edge Vercel (trustVercel), yang menulis ulang
// X-Vercel-Forwarded-For dengan IP asli. Di luar Vercel dipakai RemoteAddr.
func clientIPFunc(trustVercel bool) func(*http.Request) string {
	return func(r *http.Request) string {
		if trustVercel {
			if v := r.Header.Get("X-Vercel-Forwarded-For"); v != "" {
				first, _, _ := strings.Cut(v, ",")
				if ip := net.ParseIP(strings.TrimSpace(first)); ip != nil {
					return ip.String()
				}
			}
		}
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			return r.RemoteAddr
		}
		return host
	}
}
