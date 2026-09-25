package auth

import (
	"strings"
	"testing"
)

func TestPasswordRoundTrip(t *testing.T) {
	h, err := HashPassword("rahasia-panjang")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(h, "$argon2id$v=19$m=19456,t=2,p=1$") {
		t.Fatalf("format hash: %s", h)
	}
	ok, err := VerifyPassword("rahasia-panjang", h)
	if err != nil || !ok {
		t.Fatalf("verify benar: ok=%v err=%v", ok, err)
	}
	ok, err = VerifyPassword("salah", h)
	if err != nil || ok {
		t.Fatalf("verify salah: ok=%v err=%v", ok, err)
	}
	h2, _ := HashPassword("rahasia-panjang")
	if h == h2 {
		t.Fatal("salt harus acak")
	}
}

func TestVerifyPasswordRejectsGarbage(t *testing.T) {
	for _, bad := range []string{"", "plain", "$argon2i$v=19$m=1,t=1,p=1$YQ$YQ", "$argon2id$v=19$m=x$YQ$YQ"} {
		if ok, err := VerifyPassword("x", bad); ok || err == nil {
			t.Errorf("%q: ok=%v err=%v", bad, ok, err)
		}
	}
}

func TestSessionToken(t *testing.T) {
	tok, hash, err := NewSessionToken()
	if err != nil {
		t.Fatal(err)
	}
	if len(tok) < 40 || hash != HashSessionToken(tok) || hash == tok {
		t.Fatalf("token=%q hash=%q", tok, hash)
	}
}

func TestSigner(t *testing.T) {
	if _, err := NewSigner("pendek"); err == nil {
		t.Fatal("secret pendek harus ditolak")
	}
	s, err := NewSigner(strings.Repeat("k", 32))
	if err != nil {
		t.Fatal(err)
	}
	signed := s.Sign("state.verifier")
	if v, ok := s.Verify(signed); !ok || v != "state.verifier" {
		t.Fatalf("verify: %q %v", v, ok)
	}
	if _, ok := s.Verify(signed + "x"); ok {
		t.Fatal("tanda tangan rusak harus ditolak")
	}
	other, _ := NewSigner(strings.Repeat("z", 32))
	if _, ok := other.Verify(signed); ok {
		t.Fatal("kunci berbeda harus ditolak")
	}
}
