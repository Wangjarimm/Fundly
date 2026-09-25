// Package auth berisi hashing password, token sesi, dan Google OAuth.
package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// Parameter argon2id mengikuti rekomendasi OWASP (m=19 MiB, t=2, p=1),
// cukup ringan untuk fungsi serverless tapi tetap mahal untuk ditebak.
const (
	argonMemory  = 19 * 1024
	argonTime    = 2
	argonThreads = 1
	argonKeyLen  = 32
	saltLen      = 16
)

// MinPasswordLen dan MaxPasswordLen sesuai F-01 KP1.
const (
	MinPasswordLen = 8
	MaxPasswordLen = 128
)

var errInvalidHash = errors.New("format hash tidak valid")

// HashPassword menghasilkan string berformat PHC:
// $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>
func HashPassword(password string) (string, error) {
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemory, argonTime, argonThreads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(key)), nil
}

// VerifyPassword membandingkan password dengan hash PHC secara waktu-konstan.
func VerifyPassword(password, encoded string) (bool, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false, errInvalidHash
	}
	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != argon2.Version {
		return false, errInvalidHash
	}
	var memory, iterations uint32
	var threads uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &iterations, &threads); err != nil {
		return false, errInvalidHash
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, errInvalidHash
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil || len(want) == 0 || len(want) > 128 {
		return false, errInvalidHash
	}
	got := argon2.IDKey([]byte(password), salt, iterations, memory, threads, uint32(len(want))) //nolint:gosec // len dibatasi di atas
	return subtle.ConstantTimeCompare(got, want) == 1, nil
}

// dummyHash dipakai agar login ke email yang tidak terdaftar memakan waktu
// yang sama dengan login biasa (mencegah enumerasi email lewat waktu respons).
var dummyHash, _ = HashPassword("fundly-dummy-password")

// BurnPasswordCheck menjalankan verifikasi palsu dengan biaya yang sama.
func BurnPasswordCheck(password string) {
	_, _ = VerifyPassword(password, dummyHash)
}
