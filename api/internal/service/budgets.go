package service

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/Wangjarimm/Fundly/api/internal/db/store"
)

// Status anggaran (F-06 KP2).
const (
	BudgetSafe = "safe" // < 80%
	BudgetNear = "near" // ≥ 80%
	BudgetOver = "over" // ≥ 100%
)

// Budget adalah batas bulanan satu kategori beserta pemakaiannya.
type Budget struct {
	CategoryID  uuid.UUID
	Month       time.Time
	LimitAmount int64
	Spent       int64
	Status      string
}

// BudgetStatus menghitung status dari terpakai dan batas.
func BudgetStatus(spent, limit int64) string {
	switch {
	case limit <= 0:
		if spent > 0 {
			return BudgetOver
		}
		return BudgetSafe
	case spent*100 >= limit*100:
		return BudgetOver
	case spent*100 >= limit*80:
		return BudgetNear
	default:
		return BudgetSafe
	}
}

// ListBudgets mengembalikan anggaran bulan. Untuk bulan berjalan yang belum
// punya anggaran, anggaran bulan lalu disalin otomatis bila pengguna tidak
// mematikannya (F-06 KP3).
func (s *Service) ListBudgets(ctx context.Context, p Principal, month string) ([]Budget, error) {
	start, _, err := s.MonthRange(month)
	if err != nil {
		return nil, err
	}
	if p.User.BudgetAutoCopy {
		today := s.Today()
		current := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)
		if start.Equal(current) {
			n, err := s.q.CountBudgets(ctx, store.CountBudgetsParams{UserID: p.User.ID, Month: start})
			if err != nil {
				return nil, err
			}
			if n == 0 {
				if _, err := s.q.CopyBudgets(ctx, store.CopyBudgetsParams{
					ToMonth: start, UserID: p.User.ID, FromMonth: start.AddDate(0, -1, 0),
				}); err != nil {
					return nil, err
				}
			}
		}
	}
	rows, err := s.q.ListBudgetsWithSpent(ctx, store.ListBudgetsWithSpentParams{UserID: p.User.ID, Month: start})
	if err != nil {
		return nil, err
	}
	out := make([]Budget, 0, len(rows))
	for _, r := range rows {
		out = append(out, Budget{
			CategoryID: r.CategoryID, Month: r.Month, LimitAmount: r.LimitAmount, Spent: r.Spent,
			Status: BudgetStatus(r.Spent, r.LimitAmount),
		})
	}
	return out, nil
}

// PutBudget mengatur batas anggaran satu kategori pengeluaran (F-06 KP1).
func (s *Service) PutBudget(ctx context.Context, p Principal, categoryID uuid.UUID, month string, limit int64) (Budget, error) {
	start, _, err := s.MonthRange(month)
	if err != nil {
		return Budget{}, err
	}
	if limit < 0 || limit > MaxAmount {
		return Budget{}, invalid("Batas anggaran harus 0 atau lebih.")
	}
	c, err := s.GetCategory(ctx, p.User.ID, categoryID)
	if err != nil {
		return Budget{}, err
	}
	if c.Kind != "expense" {
		return Budget{}, invalid("Anggaran hanya untuk kategori pengeluaran.")
	}
	if err := s.q.UpsertBudget(ctx, store.UpsertBudgetParams{
		UserID: p.User.ID, CategoryID: categoryID, Month: start, LimitAmount: limit,
	}); err != nil {
		return Budget{}, err
	}
	list, err := s.ListBudgets(ctx, p, start.Format("2006-01"))
	if err != nil {
		return Budget{}, err
	}
	for _, b := range list {
		if b.CategoryID == categoryID {
			return b, nil
		}
	}
	return Budget{}, ErrNotFound
}

// DeleteBudget menghapus batas anggaran satu kategori di satu bulan.
func (s *Service) DeleteBudget(ctx context.Context, p Principal, categoryID uuid.UUID, month string) error {
	if month == "" {
		return newErr(http.StatusBadRequest, "invalid_month", "Format bulan harus YYYY-MM.")
	}
	start, _, err := s.MonthRange(month)
	if err != nil {
		return err
	}
	n, err := s.q.DeleteBudget(ctx, store.DeleteBudgetParams{UserID: p.User.ID, CategoryID: categoryID, Month: start})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
