package httpapi_test

import (
	"context"
	"encoding/csv"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/Wangjarimm/Fundly/api/internal/service"
)

type reportJSON struct {
	Month           string `json:"month"`
	TotalIncome     int64  `json:"total_income"`
	TotalExpense    int64  `json:"total_expense"`
	Net             int64  `json:"net"`
	AvgDailyExpense int64  `json:"avg_daily_expense"`
	ByCategory      []struct {
		CategoryID *string `json:"category_id"`
		Name       string  `json:"name"`
		Amount     int64   `json:"amount"`
		Percent    float64 `json:"percent"`
	} `json:"by_category"`
	Previous struct {
		TotalIncome          int64    `json:"total_income"`
		TotalExpense         int64    `json:"total_expense"`
		ExpenseChangePercent *float64 `json:"expense_change_percent"`
	} `json:"previous"`
	Daily []struct {
		Date    string `json:"date"`
		Income  int64  `json:"income"`
		Expense int64  `json:"expense"`
	} `json:"daily"`
}

const bom = "\xEF\xBB\xBF"

type budgetJSON struct {
	CategoryID  string `json:"category_id"`
	Month       string `json:"month"`
	LimitAmount int64  `json:"limit_amount"`
	Spent       int64  `json:"spent"`
	Status      string `json:"status"`
}

func (c *client) tx(wallet, kind string, amount int64, day, merchant, categoryID string) {
	c.e.t.Helper()
	body := map[string]any{"wallet_id": wallet, "kind": kind, "amount": amount, "occurred_on": day, "merchant": merchant}
	if categoryID != "" {
		body["category_id"] = categoryID
	}
	c.must(http.StatusCreated, "POST", "/api/v1/transactions", body, nil)
}

// --- F-05 Laporan bulanan ---

func TestMonthlyReport(t *testing.T) {
	e := newEnv(t)
	c, _ := e.registered()
	w := c.wallets()[0].ID
	makanan := c.categoryByName("Makanan", "expense").ID
	transport := c.categoryByName("Transport", "expense").ID
	gaji := c.categoryByName("Gaji", "income").ID

	// Bulan lampau yang lengkap agar rata-rata harian pasti (Februari 2025: 28 hari).
	c.tx(w, "expense", 60000, "2025-01-10", "Warung", makanan) // bulan lalu
	c.tx(w, "income", 3000000, "2025-02-01", "Gaji", gaji)
	c.tx(w, "expense", 50000, "2025-02-03", "Warung", makanan)
	c.tx(w, "expense", 20000, "2025-02-03", "Parkir", transport)
	c.tx(w, "expense", 14000, "2025-02-28", "Bakso", makanan)
	c.tx(w, "expense", 7000, "2025-02-14", "Tanpa kategori", "")

	var r reportJSON
	c.must(http.StatusOK, "GET", "/api/v1/reports/monthly?month=2025-02", nil, &r)
	if r.Month != "2025-02" || r.TotalIncome != 3000000 || r.TotalExpense != 91000 || r.Net != 2909000 {
		t.Fatalf("total = %+v", r)
	}
	if r.AvgDailyExpense != 91000/28 {
		t.Fatalf("avg = %d, want %d", r.AvgDailyExpense, 91000/28)
	}
	// Per kategori, terbesar dulu, persen dari total pengeluaran.
	if len(r.ByCategory) != 3 || r.ByCategory[0].Name != "Makanan" || r.ByCategory[0].Amount != 64000 {
		t.Fatalf("by_category = %+v", r.ByCategory)
	}
	if r.ByCategory[0].Percent != 70.3 {
		t.Fatalf("percent = %v, want 70.3", r.ByCategory[0].Percent)
	}
	last := r.ByCategory[len(r.ByCategory)-1]
	if last.CategoryID != nil || last.Name != "Tanpa kategori" {
		t.Fatalf("tanpa kategori = %+v", last)
	}
	// Banding bulan lalu: 91.000 vs 60.000 = +51,7%.
	if r.Previous.TotalExpense != 60000 || r.Previous.ExpenseChangePercent == nil || *r.Previous.ExpenseChangePercent != 51.7 {
		t.Fatalf("previous = %+v", r.Previous)
	}
	// Seri harian lengkap 28 hari, hari kosong = 0.
	if len(r.Daily) != 28 || r.Daily[0].Date != "2025-02-01" || r.Daily[0].Income != 3000000 || r.Daily[2].Expense != 70000 || r.Daily[1].Expense != 0 {
		t.Fatalf("daily = %+v", r.Daily[:3])
	}

	// Bulan tanpa data: nol semua, banding bulan lalu null bila bulan lalu kosong.
	var empty reportJSON
	c.must(http.StatusOK, "GET", "/api/v1/reports/monthly?month=2024-06", nil, &empty)
	if empty.TotalExpense != 0 || len(empty.ByCategory) != 0 || empty.Previous.ExpenseChangePercent != nil || len(empty.Daily) != 30 {
		t.Fatalf("empty = %+v", empty)
	}
	c.must(http.StatusBadRequest, "GET", "/api/v1/reports/monthly", nil, nil)
	c.must(http.StatusBadRequest, "GET", "/api/v1/reports/monthly?month=2025-2", nil, nil)
}

// --- F-06 Anggaran ---

func TestBudgets(t *testing.T) {
	e := newEnv(t)
	c, u := e.registered()
	w := c.wallets()[0].ID
	makanan := c.categoryByName("Makanan", "expense").ID
	belanja := c.categoryByName("Belanja", "expense").ID
	gaji := c.categoryByName("Gaji", "income").ID
	now := time.Now().In(service.Jakarta)
	month := now.Format("2006-01")
	today := now.Format("2006-01-02")

	var b budgetJSON
	c.must(http.StatusOK, "PUT", "/api/v1/budgets/"+makanan+"?month="+month, map[string]any{"limit_amount": 100000}, &b)
	if b.LimitAmount != 100000 || b.Spent != 0 || b.Status != "safe" || b.Month != month {
		t.Fatalf("budget = %+v", b)
	}
	c.must(http.StatusUnprocessableEntity, "PUT", "/api/v1/budgets/"+gaji+"?month="+month, map[string]any{"limit_amount": 1}, nil)
	c.must(http.StatusUnprocessableEntity, "PUT", "/api/v1/budgets/"+makanan+"?month="+month, map[string]any{"limit_amount": -1}, nil)
	c.must(http.StatusBadRequest, "PUT", "/api/v1/budgets/"+makanan, map[string]any{"limit_amount": 1}, nil)

	// Status: aman → hampir habis (≥80%) → terlampaui (≥100%).
	status := func() string {
		var l list[budgetJSON]
		c.must(http.StatusOK, "GET", "/api/v1/budgets?month="+month, nil, &l)
		for _, x := range l.Items {
			if x.CategoryID == makanan {
				return fmt.Sprintf("%s:%d", x.Status, x.Spent)
			}
		}
		return "hilang"
	}
	c.tx(w, "expense", 79000, today, "Warung", makanan)
	c.tx(w, "expense", 5000, today, "Toko", belanja) // kategori lain tidak dihitung
	if s := status(); s != "safe:79000" {
		t.Fatalf("status = %s", s)
	}
	c.tx(w, "expense", 1000, today, "Warung", makanan)
	if s := status(); s != "near:80000" {
		t.Fatalf("status = %s", s)
	}
	c.tx(w, "expense", 20000, today, "Warung", makanan)
	if s := status(); s != "over:100000" {
		t.Fatalf("status = %s", s)
	}

	// Salin otomatis (KP3): bulan berjalan tanpa anggaran menyalin bulan lalu.
	prev := now.AddDate(0, -1, 0).Format("2006-01")
	ctx := context.Background()
	if _, err := e.pool.Exec(ctx, `DELETE FROM budgets WHERE user_id = $1`, u.ID); err != nil {
		t.Fatal(err)
	}
	c.must(http.StatusOK, "PUT", "/api/v1/budgets/"+belanja+"?month="+prev, map[string]any{"limit_amount": 250000}, nil)
	var l list[budgetJSON]
	c.must(http.StatusOK, "GET", "/api/v1/budgets?month="+month, nil, &l)
	if len(l.Items) != 1 || l.Items[0].CategoryID != belanja || l.Items[0].LimitAmount != 250000 {
		t.Fatalf("salin otomatis = %+v", l.Items)
	}

	// Bisa dimatikan.
	if _, err := e.pool.Exec(ctx, `DELETE FROM budgets WHERE user_id = $1 AND month = date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta')::date`, u.ID); err != nil {
		t.Fatal(err)
	}
	var me struct {
		BudgetAutoCopy bool `json:"budget_auto_copy"`
	}
	c.must(http.StatusOK, "PATCH", "/api/v1/me", map[string]any{"budget_auto_copy": false}, &me)
	if me.BudgetAutoCopy {
		t.Fatal("budget_auto_copy harus false")
	}
	c.must(http.StatusOK, "GET", "/api/v1/budgets?month="+month, nil, &l)
	if len(l.Items) != 0 {
		t.Fatalf("tidak boleh menyalin saat dimatikan: %+v", l.Items)
	}

	// Hapus anggaran.
	c.must(http.StatusNoContent, "DELETE", "/api/v1/budgets/"+belanja+"?month="+prev, nil, nil)
	c.must(http.StatusNotFound, "DELETE", "/api/v1/budgets/"+belanja+"?month="+prev, nil, nil)
}

// --- Ekspor CSV (F-05 KP6, F-08 KP2) ---

func TestExportCSV(t *testing.T) {
	e := newEnv(t)
	c, _ := e.registered()
	w := c.wallets()[0].ID
	makanan := c.categoryByName("Makanan", "expense").ID
	c.tx(w, "expense", 25000, "2025-03-05", "Warung, \"Bu\" Tini", makanan)
	c.tx(w, "income", 1000, "2025-03-06", "=HYPERLINK(\"http://jahat\")", "")
	c.tx(w, "expense", 5, "2025-04-01", "April", "")

	r := c.must(http.StatusOK, "GET", "/api/v1/export/transactions.csv?month=2025-03", nil, nil)
	if ct := r.header.Get("Content-Type"); !strings.HasPrefix(ct, "text/csv") {
		t.Fatalf("content-type = %s", ct)
	}
	if cd := r.header.Get("Content-Disposition"); !strings.Contains(cd, "fundly-transaksi-2025-03.csv") {
		t.Fatalf("content-disposition = %s", cd)
	}
	body := string(r.body)
	if !strings.HasPrefix(body, bom) {
		t.Fatal("CSV harus diawali BOM UTF-8")
	}
	rows, err := csv.NewReader(strings.NewReader(strings.TrimPrefix(body, bom))).ReadAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 3 || rows[0][0] != "tanggal" {
		t.Fatalf("rows = %v", rows)
	}
	if rows[1][0] != "2025-03-05" || rows[1][1] != "pengeluaran" || rows[1][2] != "25000" || rows[1][3] != "Tunai" || rows[1][4] != "Makanan" || rows[1][5] != `Warung, "Bu" Tini` {
		t.Fatalf("baris 1 = %v", rows[1])
	}
	if rows[2][5] != `'=HYPERLINK("http://jahat")` {
		t.Fatalf("formula harus dinetralkan: %q", rows[2][5])
	}

	// Tanpa bulan = semua transaksi.
	all := c.must(http.StatusOK, "GET", "/api/v1/export/transactions.csv", nil, nil)
	allRows, _ := csv.NewReader(strings.NewReader(strings.TrimPrefix(string(all.body), bom))).ReadAll()
	if len(allRows) != 4 {
		t.Fatalf("semua = %d baris, want 4", len(allRows))
	}

	// Pengguna lain tidak melihat apa pun.
	other, _ := e.registered()
	o := other.must(http.StatusOK, "GET", "/api/v1/export/transactions.csv", nil, nil)
	oRows, _ := csv.NewReader(strings.NewReader(strings.TrimPrefix(string(o.body), bom))).ReadAll()
	if len(oRows) != 1 {
		t.Fatalf("ekspor pengguna lain bocor: %v", oRows)
	}
	e.client().must(http.StatusUnauthorized, "GET", "/api/v1/export/transactions.csv", nil, nil)
}

func TestReportAndBudgetIsolation(t *testing.T) {
	e := newEnv(t)
	alice, _ := e.registered()
	bob, _ := e.registered()
	month := time.Now().In(service.Jakarta).Format("2006-01")
	today := time.Now().In(service.Jakarta).Format("2006-01-02")
	aMakanan := alice.categoryByName("Makanan", "expense").ID
	alice.tx(alice.wallets()[0].ID, "expense", 999, today, "Rahasia", aMakanan)
	alice.must(http.StatusOK, "PUT", "/api/v1/budgets/"+aMakanan+"?month="+month, map[string]any{"limit_amount": 5000}, nil)
	var aCat categoryJSON
	alice.must(http.StatusCreated, "POST", "/api/v1/categories", map[string]any{"name": "Punya Alice", "kind": "expense"}, &aCat)

	var r reportJSON
	bob.must(http.StatusOK, "GET", "/api/v1/reports/monthly?month="+month, nil, &r)
	if r.TotalExpense != 0 || len(r.ByCategory) != 0 {
		t.Fatalf("laporan Alice bocor ke Bob: %+v", r)
	}
	var l list[budgetJSON]
	bob.must(http.StatusOK, "GET", "/api/v1/budgets?month="+month, nil, &l)
	for _, b := range l.Items {
		if b.Spent != 0 {
			t.Fatalf("pemakaian Alice terhitung di anggaran Bob: %+v", b)
		}
	}
	// Bob tidak bisa memasang anggaran pada kategori milik Alice.
	bob.must(http.StatusNotFound, "PUT", "/api/v1/budgets/"+aCat.ID+"?month="+month, map[string]any{"limit_amount": 1}, nil)
}
