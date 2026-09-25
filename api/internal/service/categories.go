package service

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/Wangjarimm/Fundly/api/internal/categorize"
	"github.com/Wangjarimm/Fundly/api/internal/db/store"
)

// Category adalah kategori dari sudut pandang satu pengguna.
type Category struct {
	ID         uuid.UUID
	Name       string
	Kind       string
	Icon       string
	ColorToken string
	SortOrder  int32
	Hidden     bool
	IsSystem   bool
}

func fromCategoryRow(id uuid.UUID, userID *uuid.UUID, name, kind, icon, color string, sort int32, hidden bool) Category {
	return Category{ID: id, Name: name, Kind: kind, Icon: icon, ColorToken: color, SortOrder: sort, Hidden: hidden, IsSystem: userID == nil}
}

// CategoryInput dipakai untuk membuat atau mengubah kategori; nil = tidak diubah.
type CategoryInput struct {
	Name       *string
	Kind       *string
	Icon       *string
	ColorToken *string
	SortOrder  *int32
	Hidden     *bool
}

func validKind(k string) bool { return k == "expense" || k == "income" }

// ListCategories mengembalikan kategori bawaan + milik pengguna (F-04 KP1).
func (s *Service) ListCategories(ctx context.Context, userID uuid.UUID, kind string, includeHidden bool) ([]Category, error) {
	rows, err := s.q.ListCategoriesForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]Category, 0, len(rows))
	for _, r := range rows {
		if (kind != "" && r.Kind != kind) || (!includeHidden && r.Hidden) {
			continue
		}
		out = append(out, fromCategoryRow(r.ID, r.UserID, r.Name, r.Kind, r.Icon, r.ColorToken, r.SortOrder, r.Hidden))
	}
	return out, nil
}

// GetCategory mengambil kategori yang boleh dilihat pengguna.
func (s *Service) GetCategory(ctx context.Context, userID, id uuid.UUID) (Category, error) {
	r, err := s.q.GetCategoryForUser(ctx, store.GetCategoryForUserParams{UserID: userID, ID: id})
	if isNoRows(err) {
		return Category{}, ErrNotFound
	}
	if err != nil {
		return Category{}, err
	}
	return fromCategoryRow(r.ID, r.UserID, r.Name, r.Kind, r.Icon, r.ColorToken, r.SortOrder, r.Hidden), nil
}

// CreateCategory membuat kategori milik pengguna.
func (s *Service) CreateCategory(ctx context.Context, userID uuid.UUID, in CategoryInput) (Category, error) {
	if in.Name == nil || in.Kind == nil {
		return Category{}, invalid("Nama dan jenis kategori wajib diisi.")
	}
	name, err := cleanName(*in.Name, 40, "Nama kategori")
	if err != nil {
		return Category{}, err
	}
	if !validKind(*in.Kind) {
		return Category{}, invalid("Jenis kategori harus expense atau income.")
	}
	icon, color := "tag", "surface-variant"
	if in.Icon != nil && strings.TrimSpace(*in.Icon) != "" {
		if icon, err = cleanName(*in.Icon, 40, "Ikon"); err != nil {
			return Category{}, err
		}
	}
	if in.ColorToken != nil && strings.TrimSpace(*in.ColorToken) != "" {
		if color, err = cleanName(*in.ColorToken, 40, "Warna"); err != nil {
			return Category{}, err
		}
	}
	uid := userID
	c, err := s.q.CreateCategory(ctx, store.CreateCategoryParams{UserID: &uid, Name: name, Kind: *in.Kind, Icon: icon, ColorToken: color})
	if err != nil {
		return Category{}, err
	}
	return fromCategoryRow(c.ID, c.UserID, c.Name, c.Kind, c.Icon, c.ColorToken, c.SortOrder, c.Hidden), nil
}

// UpdateCategory mengubah kategori milik pengguna, atau hanya menyembunyikan /
// mengurutkan kategori bawaan (F-04 KP1).
func (s *Service) UpdateCategory(ctx context.Context, userID, id uuid.UUID, in CategoryInput) (Category, error) {
	cur, err := s.GetCategory(ctx, userID, id)
	if err != nil {
		return Category{}, err
	}
	if in.Kind != nil && *in.Kind != cur.Kind {
		return Category{}, invalid("Jenis kategori tidak bisa diubah.")
	}
	hidden := cur.Hidden
	if in.Hidden != nil {
		hidden = *in.Hidden
	}

	if cur.IsSystem {
		if in.Name != nil || in.Icon != nil || in.ColorToken != nil {
			return Category{}, newErr(http.StatusForbidden, "system_category", "Kategori bawaan hanya bisa disembunyikan atau diurutkan. Buat kategori baru untuk nama lain.")
		}
		if err := s.q.UpsertCategorySetting(ctx, store.UpsertCategorySettingParams{
			UserID: userID, CategoryID: id, Hidden: hidden, SortOrder: in.SortOrder,
		}); err != nil {
			return Category{}, err
		}
		return s.GetCategory(ctx, userID, id)
	}

	p := store.UpdateOwnCategoryParams{
		Name: cur.Name, Icon: cur.Icon, ColorToken: cur.ColorToken, SortOrder: cur.SortOrder,
		Hidden: hidden, ID: id, UserID: &userID,
	}
	if in.Name != nil {
		if p.Name, err = cleanName(*in.Name, 40, "Nama kategori"); err != nil {
			return Category{}, err
		}
	}
	if in.Icon != nil {
		if p.Icon, err = cleanName(*in.Icon, 40, "Ikon"); err != nil {
			return Category{}, err
		}
	}
	if in.ColorToken != nil {
		if p.ColorToken, err = cleanName(*in.ColorToken, 40, "Warna"); err != nil {
			return Category{}, err
		}
	}
	if in.SortOrder != nil {
		p.SortOrder = *in.SortOrder
	}
	c, err := s.q.UpdateOwnCategory(ctx, p)
	if isNoRows(err) {
		return Category{}, ErrNotFound
	}
	if err != nil {
		return Category{}, err
	}
	return fromCategoryRow(c.ID, c.UserID, c.Name, c.Kind, c.Icon, c.ColorToken, c.SortOrder, c.Hidden), nil
}

func (s *Service) loadRules(ctx context.Context, userID uuid.UUID) ([]categorize.Rule, error) {
	rows, err := s.q.ListRulesForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	rules := make([]categorize.Rule, 0, len(rows))
	for _, r := range rows {
		rules = append(rules, categorize.Rule{
			Keyword: r.Keyword, CategoryID: r.CategoryID, Priority: r.Priority, IsUser: r.UserID != nil, Kind: r.Kind,
		})
	}
	return rules, nil
}

// SuggestCategory menyarankan kategori dari merchant dan catatan (F-04 KP2).
// Merchant dicoba lebih dulu karena paling spesifik.
func (s *Service) SuggestCategory(ctx context.Context, userID uuid.UUID, merchant, note, kind string) (*categorize.Suggestion, error) {
	if kind != "" && !validKind(kind) {
		return nil, invalid("Jenis harus expense atau income.")
	}
	if len(merchant) > 500 || len(note) > 2000 {
		return nil, invalid("Teks terlalu panjang.")
	}
	rules, err := s.loadRules(ctx, userID)
	if err != nil {
		return nil, err
	}
	for _, text := range []string{merchant, note} {
		if sug, ok := categorize.Suggest(text, kind, rules); ok {
			return &sug, nil
		}
	}
	return nil, nil
}

// learnFromCorrection menyimpan aturan pribadi "merchant → kategori" bila
// pilihan pengguna berbeda dari saran otomatis (F-04 KP3).
func (s *Service) learnFromCorrection(ctx context.Context, userID uuid.UUID, merchant *string, categoryID *uuid.UUID, kind string) error {
	if merchant == nil || categoryID == nil {
		return nil
	}
	keyword := categorize.KeywordFor(*merchant)
	if keyword == "" {
		return nil
	}
	rules, err := s.loadRules(ctx, userID)
	if err != nil {
		return err
	}
	if sug, ok := categorize.Suggest(*merchant, kind, rules); ok && sug.CategoryID == *categoryID {
		return nil
	}
	uid := userID
	return s.q.UpsertUserRule(ctx, store.UpsertUserRuleParams{UserID: &uid, Keyword: keyword, CategoryID: *categoryID})
}
