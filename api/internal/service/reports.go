package service

import (
	"context"
	"math"
	"time"

	"github.com/google/uuid"

	"github.com/Wangjarimm/Fundly/api/internal/db/store"
)

// CategorySpend adalah pengeluaran satu kategori dalam laporan.
type CategorySpend struct {
	CategoryID *uuid.UUID
	Name       string
	Amount     int64
	Percent    float64
}

// DayPoint adalah satu titik tren harian.
type DayPoint struct {
	Date    time.Time
	Income  int64
	Expense int64
}

// MonthlyReport adalah laporan bulanan (F-05).
type MonthlyReport struct {
	Month           string
	TotalIncome     int64
	TotalExpense    int64
	Net             int64
	AvgDailyExpense int64
	ByCategory      []CategorySpend
	PrevIncome      int64
	PrevExpense     int64
	// ExpenseChangePercent nil bila bulan lalu tanpa pengeluaran (tidak bisa dibandingkan).
	ExpenseChangePercent *float64
	Daily                []DayPoint
}

func round1(v float64) float64 { return math.Round(v*10) / 10 }

// MonthlyReport menghitung ringkasan bulan; semua agregat di SQL (PRD bagian 7).
func (s *Service) MonthlyReport(ctx context.Context, userID uuid.UUID, month string) (MonthlyReport, error) {
	start, end, err := s.MonthRange(month)
	if err != nil {
		return MonthlyReport{}, err
	}
	prevStart := start.AddDate(0, -1, 0)

	cur, err := s.q.MonthTotals(ctx, store.MonthTotalsParams{UserID: userID, MonthStart: start, MonthEnd: end})
	if err != nil {
		return MonthlyReport{}, err
	}
	prev, err := s.q.MonthTotals(ctx, store.MonthTotalsParams{UserID: userID, MonthStart: prevStart, MonthEnd: start})
	if err != nil {
		return MonthlyReport{}, err
	}
	cats, err := s.q.ExpenseByCategory(ctx, store.ExpenseByCategoryParams{UserID: userID, MonthStart: start, MonthEnd: end})
	if err != nil {
		return MonthlyReport{}, err
	}
	days, err := s.q.DailySeries(ctx, store.DailySeriesParams{MonthStart: start, LastDay: end.AddDate(0, 0, -1), UserID: userID})
	if err != nil {
		return MonthlyReport{}, err
	}

	r := MonthlyReport{
		Month:        start.Format("2006-01"),
		TotalIncome:  cur.Income,
		TotalExpense: cur.Expense,
		Net:          cur.Income - cur.Expense,
		PrevIncome:   prev.Income,
		PrevExpense:  prev.Expense,
		ByCategory:   make([]CategorySpend, 0, len(cats)),
		Daily:        make([]DayPoint, 0, len(days)),
	}

	// Rata-rata harian: bulan berjalan dibagi hari yang sudah lewat, bulan lampau
	// dibagi jumlah hari penuh, bulan depan dianggap 0.
	today := s.Today()
	elapsed := int(end.Sub(start).Hours() / 24)
	switch {
	case !today.Before(end):
	case today.Before(start):
		elapsed = 0
	default:
		elapsed = int(today.Sub(start).Hours()/24) + 1
	}
	if elapsed > 0 {
		r.AvgDailyExpense = cur.Expense / int64(elapsed)
	}

	if prev.Expense > 0 {
		change := round1(float64(cur.Expense-prev.Expense) / float64(prev.Expense) * 100)
		r.ExpenseChangePercent = &change
	}

	for _, c := range cats {
		name := "Tanpa kategori"
		if c.CategoryName != nil {
			name = *c.CategoryName
		}
		pct := 0.0
		if cur.Expense > 0 {
			pct = round1(float64(c.Amount) / float64(cur.Expense) * 100)
		}
		r.ByCategory = append(r.ByCategory, CategorySpend{CategoryID: c.CategoryID, Name: name, Amount: c.Amount, Percent: pct})
	}
	for _, d := range days {
		r.Daily = append(r.Daily, DayPoint{Date: d.Day, Income: d.Income, Expense: d.Expense})
	}
	return r, nil
}
