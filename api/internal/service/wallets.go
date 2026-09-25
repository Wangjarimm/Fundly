package service

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/Wangjarimm/Fundly/api/internal/db/store"
)

// MaxAmount membatasi nilai uang agar tetap aman sebagai number di JavaScript.
const MaxAmount int64 = 999_999_999_999_999

// WalletWithBalance adalah dompet beserta saldo sekarang.
type WalletWithBalance struct {
	store.Wallet
	Balance int64
}

// WalletInput dipakai untuk membuat atau mengubah dompet; nil = tidak diubah.
type WalletInput struct {
	Name           *string
	Type           *string
	Provider       **string // nil = tidak diubah, &nil = hapus
	InitialBalance *int64
	Archived       *bool
}

func validWalletType(t string) bool {
	switch t {
	case "cash", "bank", "ewallet", "other":
		return true
	}
	return false
}

func cleanName(name string, maxLen int, label string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", invalid(label + " belum diisi.")
	}
	if utf8.RuneCountInString(name) > maxLen {
		return "", invalid(label + " terlalu panjang.")
	}
	return name, nil
}

func cleanOptional(s *string, maxLen int, label string) (*string, error) {
	if s == nil {
		return nil, nil
	}
	v := strings.TrimSpace(*s)
	if v == "" {
		return nil, nil
	}
	if utf8.RuneCountInString(v) > maxLen {
		return nil, invalid(label + " terlalu panjang.")
	}
	return &v, nil
}

func validBalance(v int64) error {
	if v > MaxAmount || v < -MaxAmount {
		return invalid("Saldo awal terlalu besar.")
	}
	return nil
}

// ListWallets mengembalikan dompet pengguna beserta saldo (F-02 KP3).
func (s *Service) ListWallets(ctx context.Context, userID uuid.UUID, includeArchived bool) ([]WalletWithBalance, error) {
	rows, err := s.q.ListWalletsWithBalance(ctx, store.ListWalletsWithBalanceParams{UserID: userID, IncludeArchived: includeArchived})
	if err != nil {
		return nil, err
	}
	out := make([]WalletWithBalance, 0, len(rows))
	for _, r := range rows {
		out = append(out, WalletWithBalance{Wallet: store.Wallet{
			ID: r.ID, UserID: r.UserID, Name: r.Name, Type: r.Type, Provider: r.Provider,
			InitialBalance: r.InitialBalance, ArchivedAt: r.ArchivedAt, CreatedAt: r.CreatedAt,
		}, Balance: r.Balance})
	}
	return out, nil
}

func (s *Service) getWalletWithBalance(ctx context.Context, userID, id uuid.UUID) (WalletWithBalance, error) {
	r, err := s.q.GetWalletWithBalance(ctx, store.GetWalletWithBalanceParams{UserID: userID, ID: id})
	if isNoRows(err) {
		return WalletWithBalance{}, ErrNotFound
	}
	if err != nil {
		return WalletWithBalance{}, err
	}
	return WalletWithBalance{Wallet: store.Wallet{
		ID: r.ID, UserID: r.UserID, Name: r.Name, Type: r.Type, Provider: r.Provider,
		InitialBalance: r.InitialBalance, ArchivedAt: r.ArchivedAt, CreatedAt: r.CreatedAt,
	}, Balance: r.Balance}, nil
}

// CreateWallet membuat dompet baru (F-02 KP1, KP2).
func (s *Service) CreateWallet(ctx context.Context, userID uuid.UUID, in WalletInput) (WalletWithBalance, error) {
	if in.Name == nil || in.Type == nil {
		return WalletWithBalance{}, invalid("Nama dan jenis dompet wajib diisi.")
	}
	name, err := cleanName(*in.Name, 40, "Nama dompet")
	if err != nil {
		return WalletWithBalance{}, err
	}
	if !validWalletType(*in.Type) {
		return WalletWithBalance{}, invalid("Jenis dompet tidak dikenal.")
	}
	var provider *string
	if in.Provider != nil {
		if provider, err = cleanOptional(*in.Provider, 40, "Nama penyedia"); err != nil {
			return WalletWithBalance{}, err
		}
	}
	var initial int64
	if in.InitialBalance != nil {
		initial = *in.InitialBalance
	}
	if err := validBalance(initial); err != nil {
		return WalletWithBalance{}, err
	}
	w, err := s.q.CreateWallet(ctx, store.CreateWalletParams{
		UserID: userID, Name: name, Type: *in.Type, Provider: provider, InitialBalance: initial,
	})
	if err != nil {
		return WalletWithBalance{}, err
	}
	return WalletWithBalance{Wallet: w, Balance: initial}, nil
}

// UpdateWallet mengubah atau mengarsipkan dompet (F-02 KP1).
func (s *Service) UpdateWallet(ctx context.Context, userID, id uuid.UUID, in WalletInput) (WalletWithBalance, error) {
	cur, err := s.q.GetWallet(ctx, store.GetWalletParams{UserID: userID, ID: id})
	if isNoRows(err) {
		return WalletWithBalance{}, ErrNotFound
	}
	if err != nil {
		return WalletWithBalance{}, err
	}
	p := store.UpdateWalletParams{
		Name: cur.Name, Type: cur.Type, Provider: cur.Provider, InitialBalance: cur.InitialBalance,
		ArchivedAt: cur.ArchivedAt, UserID: userID, ID: id,
	}
	if in.Name != nil {
		if p.Name, err = cleanName(*in.Name, 40, "Nama dompet"); err != nil {
			return WalletWithBalance{}, err
		}
	}
	if in.Type != nil {
		if !validWalletType(*in.Type) {
			return WalletWithBalance{}, invalid("Jenis dompet tidak dikenal.")
		}
		p.Type = *in.Type
	}
	if in.Provider != nil {
		if p.Provider, err = cleanOptional(*in.Provider, 40, "Nama penyedia"); err != nil {
			return WalletWithBalance{}, err
		}
	}
	if in.InitialBalance != nil {
		if err := validBalance(*in.InitialBalance); err != nil {
			return WalletWithBalance{}, err
		}
		p.InitialBalance = *in.InitialBalance
	}
	if in.Archived != nil {
		switch {
		case *in.Archived && cur.ArchivedAt == nil:
			now := s.now().UTC().Truncate(time.Microsecond)
			p.ArchivedAt = &now
		case !*in.Archived:
			p.ArchivedAt = nil
		}
	}
	if _, err := s.q.UpdateWallet(ctx, p); err != nil {
		return WalletWithBalance{}, err
	}
	return s.getWalletWithBalance(ctx, userID, id)
}
