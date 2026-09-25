package service

import "testing"

func TestBudgetStatus(t *testing.T) {
	cases := []struct {
		spent, limit int64
		want         string
	}{
		{0, 100, BudgetSafe},
		{79, 100, BudgetSafe},
		{80, 100, BudgetNear},
		{99, 100, BudgetNear},
		{100, 100, BudgetOver},
		{150, 100, BudgetOver},
		{0, 0, BudgetSafe},
		{1, 0, BudgetOver},
		{MaxAmount, MaxAmount, BudgetOver},
	}
	for _, c := range cases {
		if got := BudgetStatus(c.spent, c.limit); got != c.want {
			t.Errorf("BudgetStatus(%d, %d) = %s, want %s", c.spent, c.limit, got, c.want)
		}
	}
}

func TestCSVSafe(t *testing.T) {
	cases := map[string]string{
		"Indomaret":         "Indomaret",
		"=HYPERLINK(\"x\")": "'=HYPERLINK(\"x\")",
		"+62812":            "'+62812",
		"-5":                "'-5",
		"@SUM(A1)":          "'@SUM(A1)",
		"":                  "",
	}
	for in, want := range cases {
		if got := csvSafe(in); got != want {
			t.Errorf("csvSafe(%q) = %q, want %q", in, got, want)
		}
	}
}
