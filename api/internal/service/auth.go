package service

import (
	"context"
	"net/http"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/Wangjarimm/Fundly/api/internal/auth"
	"github.com/Wangjarimm/Fundly/api/internal/db/store"
)

// Principal adalah pengguna yang sedang masuk.
type Principal struct {
	User      store.User
	SessionID uuid.UUID
}

// NewSession adalah sesi yang baru dibuat atau diperpanjang.
type NewSession struct {
	Token     string
	ExpiresAt time.Time
}

const maxDisplayNameLen = 60

// NormalizeEmail merapikan dan memvalidasi alamat email.
func NormalizeEmail(email string) (string, error) {
	e := strings.ToLower(strings.TrimSpace(email))
	if e == "" || len(e) > 254 {
		return "", invalid("Email belum diisi dengan benar.")
	}
	addr, err := mail.ParseAddress(e)
	if err != nil || addr.Address != e || !strings.Contains(e[strings.LastIndexByte(e, '@')+1:], ".") {
		return "", invalid("Format email belum benar. Contoh: nama@contoh.com")
	}
	return e, nil
}

func validatePassword(pw string) error {
	n := utf8.RuneCountInString(pw)
	if n < auth.MinPasswordLen {
		return invalid("Password minimal 8 karakter.")
	}
	if len(pw) > auth.MaxPasswordLen {
		return invalid("Password maksimal 128 karakter.")
	}
	return nil
}

func cleanDisplayName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if utf8.RuneCountInString(name) > maxDisplayNameLen {
		return "", invalid("Nama maksimal 60 karakter.")
	}
	return name, nil
}

// Register membuat akun baru beserta dompet "Tunai" (F-01 KP1, F-02 KP4).
func (s *Service) Register(ctx context.Context, email, password, displayName string) (store.User, NewSession, error) {
	email, err := NormalizeEmail(email)
	if err != nil {
		return store.User{}, NewSession{}, err
	}
	if err := validatePassword(password); err != nil {
		return store.User{}, NewSession{}, err
	}
	displayName, err = cleanDisplayName(displayName)
	if err != nil {
		return store.User{}, NewSession{}, err
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return store.User{}, NewSession{}, err
	}
	user, err := s.createUserWithDefaults(ctx, store.CreateUserParams{
		Email: email, PasswordHash: &hash, DisplayName: displayName,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return store.User{}, NewSession{}, newErr(http.StatusConflict, "email_taken", "Email ini sudah terdaftar. Silakan masuk.")
		}
		return store.User{}, NewSession{}, err
	}
	sess, err := s.createSession(ctx, user.ID)
	return user, sess, err
}

func (s *Service) createUserWithDefaults(ctx context.Context, p store.CreateUserParams) (store.User, error) {
	var user store.User
	err := s.inTx(ctx, func(q *store.Queries) error {
		var err error
		user, err = q.CreateUser(ctx, p)
		if err != nil {
			return err
		}
		_, err = q.CreateWallet(ctx, store.CreateWalletParams{
			UserID: user.ID, Name: "Tunai", Type: "cash", InitialBalance: 0,
		})
		return err
	})
	return user, err
}

var errBadCredentials = newErr(http.StatusUnauthorized, "invalid_credentials", "Email atau password belum cocok. Periksa lalu coba lagi.")

// Login memeriksa email dan password.
func (s *Service) Login(ctx context.Context, email, password string) (store.User, NewSession, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if len(password) > auth.MaxPasswordLen {
		return store.User{}, NewSession{}, errBadCredentials
	}
	user, err := s.q.GetUserByEmail(ctx, email)
	if err != nil && !isNoRows(err) {
		return store.User{}, NewSession{}, err
	}
	if err != nil || user.PasswordHash == nil {
		auth.BurnPasswordCheck(password)
		return store.User{}, NewSession{}, errBadCredentials
	}
	ok, err := auth.VerifyPassword(password, *user.PasswordHash)
	if err != nil || !ok {
		return store.User{}, NewSession{}, errBadCredentials
	}
	sess, err := s.createSession(ctx, user.ID)
	return user, sess, err
}

// LoginWithGoogle masuk atau mendaftar lewat akun Google (F-01 KP2).
func (s *Service) LoginWithGoogle(ctx context.Context, gu auth.GoogleUser) (store.User, NewSession, error) {
	if !gu.EmailVerified {
		return store.User{}, NewSession{}, newErr(http.StatusBadRequest, "google_email_unverified", "Email akun Google belum terverifikasi.")
	}
	email, err := NormalizeEmail(gu.Email)
	if err != nil {
		return store.User{}, NewSession{}, err
	}
	sub := gu.Sub

	user, err := s.q.GetUserByGoogleSub(ctx, &sub)
	switch {
	case err == nil:
	case !isNoRows(err):
		return store.User{}, NewSession{}, err
	default:
		existing, err := s.q.GetUserByEmail(ctx, email)
		switch {
		case err == nil:
			user, err = s.q.LinkGoogleAccount(ctx, store.LinkGoogleAccountParams{GoogleSub: &sub, ID: existing.ID})
			if err != nil {
				return store.User{}, NewSession{}, err
			}
		case isNoRows(err):
			name, _ := cleanDisplayName(gu.Name)
			user, err = s.createUserWithDefaults(ctx, store.CreateUserParams{
				Email: email, GoogleSub: &sub, DisplayName: name,
			})
			if err != nil {
				return store.User{}, NewSession{}, err
			}
		default:
			return store.User{}, NewSession{}, err
		}
	}
	sess, err := s.createSession(ctx, user.ID)
	return user, sess, err
}

func (s *Service) createSession(ctx context.Context, userID uuid.UUID) (NewSession, error) {
	token, hash, err := auth.NewSessionToken()
	if err != nil {
		return NewSession{}, err
	}
	expires := s.now().Add(auth.SessionTTL)
	if _, err := s.q.CreateSession(ctx, store.CreateSessionParams{UserID: userID, TokenHash: hash, ExpiresAt: expires}); err != nil {
		return NewSession{}, err
	}
	// Bersihkan sesi kedaluwarsa milik pengguna ini (murah, terindeks).
	_ = s.q.DeleteExpiredSessions(ctx, userID)
	return NewSession{Token: token, ExpiresAt: expires}, nil
}

// Authenticate memeriksa token sesi. Bila sesi sudah berumur lebih dari
// SessionRefreshAfter sejak diperpanjang, masa berlakunya diperpanjang lagi
// dan refreshed berisi sesi baru untuk dikirim ulang sebagai cookie.
func (s *Service) Authenticate(ctx context.Context, token string) (Principal, *NewSession, error) {
	if token == "" || len(token) > 128 {
		return Principal{}, nil, ErrUnauthorized
	}
	row, err := s.q.GetSessionByTokenHash(ctx, auth.HashSessionToken(token))
	if isNoRows(err) {
		return Principal{}, nil, ErrUnauthorized
	}
	if err != nil {
		return Principal{}, nil, err
	}
	p := Principal{
		SessionID: row.SessionID,
		User: store.User{
			ID: row.ID, Email: row.Email, PasswordHash: row.PasswordHash, GoogleSub: row.GoogleSub,
			DisplayName: row.DisplayName, Theme: row.Theme, CreatedAt: row.CreatedAt,
		},
	}
	now := s.now()
	if row.ExpiresAt.Sub(now) < auth.SessionTTL-auth.SessionRefreshAfter {
		expires := now.Add(auth.SessionTTL)
		if err := s.q.TouchSession(ctx, store.TouchSessionParams{ExpiresAt: expires, ID: row.SessionID}); err != nil {
			return Principal{}, nil, err
		}
		return p, &NewSession{Token: token, ExpiresAt: expires}, nil
	}
	return p, nil, nil
}

// Logout menghapus sesi di server (F-01 KP4).
func (s *Service) Logout(ctx context.Context, token string) error {
	return s.q.DeleteSessionByTokenHash(ctx, auth.HashSessionToken(token))
}

// UpdateMeInput adalah perubahan profil; nil = tidak diubah.
type UpdateMeInput struct {
	DisplayName     *string
	Theme           *string
	CurrentPassword *string
	NewPassword     *string
}

// UpdateMe mengubah profil, tema, atau password (F-08 KP1).
func (s *Service) UpdateMe(ctx context.Context, p Principal, in UpdateMeInput) (store.User, error) {
	if in.DisplayName != nil {
		name, err := cleanDisplayName(*in.DisplayName)
		if err != nil {
			return store.User{}, err
		}
		in.DisplayName = &name
	}
	if in.Theme != nil {
		switch *in.Theme {
		case "system", "light", "dark":
		default:
			return store.User{}, invalid("Tema harus system, light, atau dark.")
		}
	}
	if in.NewPassword != nil {
		if err := validatePassword(*in.NewPassword); err != nil {
			return store.User{}, err
		}
		if p.User.PasswordHash != nil {
			if in.CurrentPassword == nil {
				return store.User{}, invalid("Masukkan password saat ini untuk menggantinya.")
			}
			ok, err := auth.VerifyPassword(*in.CurrentPassword, *p.User.PasswordHash)
			if err != nil || !ok {
				return store.User{}, invalid("Password saat ini belum cocok.")
			}
		}
		hash, err := auth.HashPassword(*in.NewPassword)
		if err != nil {
			return store.User{}, err
		}
		if err := s.q.UpdateUserPassword(ctx, store.UpdateUserPasswordParams{PasswordHash: &hash, ID: p.User.ID}); err != nil {
			return store.User{}, err
		}
		// Keluarkan perangkat lain setelah ganti password.
		if err := s.q.DeleteOtherSessions(ctx, store.DeleteOtherSessionsParams{UserID: p.User.ID, KeepID: p.SessionID}); err != nil {
			return store.User{}, err
		}
	}
	return s.q.UpdateUserProfile(ctx, store.UpdateUserProfileParams{
		DisplayName: in.DisplayName, Theme: in.Theme, ID: p.User.ID,
	})
}

// DeleteMe menghapus akun dan semua datanya (cascade) secara permanen (F-01 KP5).
func (s *Service) DeleteMe(ctx context.Context, p Principal, confirm string) error {
	if confirm != "HAPUS" {
		return invalid(`Ketik "HAPUS" untuk mengonfirmasi penghapusan akun.`)
	}
	return s.q.DeleteUser(ctx, p.User.ID)
}
