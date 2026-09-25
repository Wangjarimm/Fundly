package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"strings"
	"time"
)

// SessionTTL adalah masa berlaku sesi: 30 hari dan diperpanjang saat aktif (F-01 KP3).
const SessionTTL = 30 * 24 * time.Hour

// SessionRefreshAfter menentukan kapan masa berlaku diperpanjang paling sering sekali sehari
// agar tidak menulis ke database di setiap permintaan.
const SessionRefreshAfter = 24 * time.Hour

// SessionCookieName adalah nama cookie sesi.
const SessionCookieName = "fundly_session"

// NewSessionToken menghasilkan token acak 256-bit (dikirim ke klien)
// dan hash SHA-256-nya (disimpan di database).
func NewSessionToken() (token, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	token = base64.RawURLEncoding.EncodeToString(b)
	return token, HashSessionToken(token), nil
}

// HashSessionToken mengubah token menjadi nilai yang disimpan di tabel sessions.
// Kebocoran tabel tidak membocorkan token yang bisa dipakai.
func HashSessionToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// Signer menandatangani nilai kecil (mis. state OAuth di cookie) dengan HMAC.
type Signer struct{ key []byte }

// NewSigner membuat Signer dari SESSION_SECRET.
func NewSigner(secret string) (*Signer, error) {
	if len(secret) < 32 {
		return nil, errors.New("SESSION_SECRET minimal 32 karakter")
	}
	return &Signer{key: []byte(secret)}, nil
}

// Sign mengembalikan "<nilai>.<tanda tangan>".
func (s *Signer) Sign(value string) string {
	return value + "." + s.mac(value)
}

// Verify mengembalikan nilai asli bila tanda tangannya cocok.
func (s *Signer) Verify(signed string) (string, bool) {
	i := strings.LastIndexByte(signed, '.')
	if i < 0 {
		return "", false
	}
	value, sig := signed[:i], signed[i+1:]
	if !hmac.Equal([]byte(sig), []byte(s.mac(value))) {
		return "", false
	}
	return value, true
}

func (s *Signer) mac(value string) string {
	m := hmac.New(sha256.New, s.key)
	m.Write([]byte(value))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

// RandomString menghasilkan string acak URL-safe dengan n byte entropi.
func RandomString(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
