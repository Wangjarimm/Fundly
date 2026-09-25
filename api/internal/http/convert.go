package httpapi

import (
	"github.com/google/uuid"
	"github.com/oapi-codegen/nullable"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/Wangjarimm/Fundly/api/internal/db/store"
	"github.com/Wangjarimm/Fundly/api/internal/http/apigen"
	"github.com/Wangjarimm/Fundly/api/internal/service"
)

// Konversi antara model database/service dan tipe hasil generate OpenAPI.

func toUser(u store.User) apigen.User {
	return apigen.User{
		Id:          u.ID,
		Email:       openapi_types.Email(u.Email),
		DisplayName: u.DisplayName,
		Theme:       apigen.UserTheme(u.Theme),
		HasPassword: u.PasswordHash != nil,
		HasGoogle:   u.GoogleSub != nil,
		CreatedAt:   u.CreatedAt,
	}
}

func toWallet(w service.WalletWithBalance) apigen.Wallet {
	return apigen.Wallet{
		Id:             w.ID,
		Name:           w.Name,
		Type:           apigen.WalletType(w.Type),
		Provider:       nullableOf(w.Provider),
		InitialBalance: w.InitialBalance,
		Balance:        w.Balance,
		ArchivedAt:     nullableOf(w.ArchivedAt),
		CreatedAt:      w.CreatedAt,
	}
}

func toCategory(c service.Category) apigen.Category {
	return apigen.Category{
		Id:         c.ID,
		Name:       c.Name,
		Kind:       apigen.Kind(c.Kind),
		Icon:       c.Icon,
		ColorToken: c.ColorToken,
		SortOrder:  int(c.SortOrder),
		Hidden:     c.Hidden,
		IsSystem:   c.IsSystem,
	}
}

func toTransaction(t store.Transaction) apigen.Transaction {
	return apigen.Transaction{
		Id:         t.ID,
		WalletId:   t.WalletID,
		CategoryId: nullableOf(t.CategoryID),
		Kind:       apigen.Kind(t.Kind),
		Amount:     t.Amount,
		OccurredOn: openapi_types.Date{Time: t.OccurredOn},
		Merchant:   nullableOf(t.Merchant),
		Note:       nullableOf(t.Note),
		Source:     apigen.TransactionSource(t.Source),
		ClientId:   nullableOf(t.ClientID),
		CreatedAt:  t.CreatedAt,
		UpdatedAt:  t.UpdatedAt,
	}
}

// nullableOf mengubah pointer menjadi Nullable yang selalu ter-set
// (nil → null eksplisit di JSON, sesuai skema yang mewajibkan field ada).
func nullableOf[T any](p *T) nullable.Nullable[T] {
	if p == nil {
		return nullable.NewNullNullable[T]()
	}
	return nullable.NewNullableWithValue(*p)
}

// patchOf mengubah Nullable dari body PATCH menjadi pointer ganda:
// nil = field tidak dikirim, &nil = dikirim null, &&v = dikirim nilai.
func patchOf[T any](n nullable.Nullable[T]) **T {
	if !n.IsSpecified() {
		return nil
	}
	if n.IsNull() {
		var p *T
		return &p
	}
	v := n.MustGet()
	p := &v
	return &p
}

func uuidPtr(u *openapi_types.UUID) *uuid.UUID {
	if u == nil {
		return nil
	}
	v := *u
	return &v
}

func strOf(n nullable.Nullable[string]) string {
	if v, err := n.Get(); err == nil {
		return v
	}
	return ""
}
