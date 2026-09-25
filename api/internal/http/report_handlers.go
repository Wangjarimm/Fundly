package httpapi

import (
	"bytes"
	"fmt"
	"net/http"
	"strconv"

	"github.com/Wangjarimm/Fundly/api/internal/http/apigen"
	"github.com/Wangjarimm/Fundly/api/internal/service"
)

// Bentuk JSON mengikuti skema MonthlyReport di api-spec/openapi.yaml.
type reportCategory struct {
	CategoryID *string `json:"category_id"`
	Name       string  `json:"name"`
	Amount     int64   `json:"amount"`
	Percent    float64 `json:"percent"`
}

type reportPrevious struct {
	TotalIncome          int64    `json:"total_income"`
	TotalExpense         int64    `json:"total_expense"`
	ExpenseChangePercent *float64 `json:"expense_change_percent"`
}

type reportDay struct {
	Date    string `json:"date"`
	Income  int64  `json:"income"`
	Expense int64  `json:"expense"`
}

type reportResponse struct {
	Month           string           `json:"month"`
	TotalIncome     int64            `json:"total_income"`
	TotalExpense    int64            `json:"total_expense"`
	Net             int64            `json:"net"`
	AvgDailyExpense int64            `json:"avg_daily_expense"`
	ByCategory      []reportCategory `json:"by_category"`
	Previous        reportPrevious   `json:"previous"`
	Daily           []reportDay      `json:"daily"`
}

func (a *api) monthlyReport(w http.ResponseWriter, r *http.Request) {
	month := r.URL.Query().Get("month")
	if month == "" {
		writeError(w, http.StatusBadRequest, "invalid_month", "Format bulan harus YYYY-MM.")
		return
	}
	rep, err := a.svc.MonthlyReport(r.Context(), principalFrom(r.Context()).User.ID, month)
	if err != nil {
		a.fail(w, r, err)
		return
	}
	res := reportResponse{
		Month: rep.Month, TotalIncome: rep.TotalIncome, TotalExpense: rep.TotalExpense, Net: rep.Net,
		AvgDailyExpense: rep.AvgDailyExpense,
		ByCategory:      make([]reportCategory, 0, len(rep.ByCategory)),
		Previous:        reportPrevious{TotalIncome: rep.PrevIncome, TotalExpense: rep.PrevExpense, ExpenseChangePercent: rep.ExpenseChangePercent},
		Daily:           make([]reportDay, 0, len(rep.Daily)),
	}
	for _, c := range rep.ByCategory {
		var id *string
		if c.CategoryID != nil {
			s := c.CategoryID.String()
			id = &s
		}
		res.ByCategory = append(res.ByCategory, reportCategory{CategoryID: id, Name: c.Name, Amount: c.Amount, Percent: c.Percent})
	}
	for _, d := range rep.Daily {
		res.Daily = append(res.Daily, reportDay{Date: d.Date.Format("2006-01-02"), Income: d.Income, Expense: d.Expense})
	}
	writeJSON(w, http.StatusOK, res)
}

func toBudget(b service.Budget) apigen.Budget {
	return apigen.Budget{
		CategoryId:  b.CategoryID,
		Month:       b.Month.Format("2006-01"),
		LimitAmount: b.LimitAmount,
		Spent:       b.Spent,
		Status:      apigen.BudgetStatus(b.Status),
	}
}

func (a *api) listBudgets(w http.ResponseWriter, r *http.Request) {
	month := r.URL.Query().Get("month")
	if month == "" {
		writeError(w, http.StatusBadRequest, "invalid_month", "Format bulan harus YYYY-MM.")
		return
	}
	bs, err := a.svc.ListBudgets(r.Context(), principalFrom(r.Context()), month)
	if err != nil {
		a.fail(w, r, err)
		return
	}
	items := make([]apigen.Budget, 0, len(bs))
	for _, b := range bs {
		items = append(items, toBudget(b))
	}
	writeJSON(w, http.StatusOK, listResponse[apigen.Budget]{Items: items})
}

func (a *api) putBudget(w http.ResponseWriter, r *http.Request) {
	categoryID, ok := pathUUID(w, r, "category_id")
	if !ok {
		return
	}
	month := r.URL.Query().Get("month")
	if month == "" {
		writeError(w, http.StatusBadRequest, "invalid_month", "Format bulan harus YYYY-MM.")
		return
	}
	var body apigen.PutBudgetJSONBody
	if !decodeJSON(w, r, &body) {
		return
	}
	b, err := a.svc.PutBudget(r.Context(), principalFrom(r.Context()), categoryID, month, body.LimitAmount)
	if err != nil {
		a.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toBudget(b))
}

func (a *api) deleteBudget(w http.ResponseWriter, r *http.Request) {
	categoryID, ok := pathUUID(w, r, "category_id")
	if !ok {
		return
	}
	if err := a.svc.DeleteBudget(r.Context(), principalFrom(r.Context()), categoryID, r.URL.Query().Get("month")); err != nil {
		a.fail(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *api) exportCSV(w http.ResponseWriter, r *http.Request) {
	month := r.URL.Query().Get("month")
	// Tulis ke buffer dulu agar error bisa dijawab dengan format JSON biasa.
	var buf bytes.Buffer
	if err := a.svc.ExportTransactionsCSV(r.Context(), principalFrom(r.Context()).User.ID, month, &buf); err != nil {
		a.fail(w, r, err)
		return
	}
	name := "fundly-transaksi-semua.csv"
	if month != "" {
		name = fmt.Sprintf("fundly-transaksi-%s.csv", month)
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="`+name+`"`)
	w.Header().Set("Content-Length", strconv.Itoa(buf.Len()))
	_, _ = w.Write(buf.Bytes())
}
