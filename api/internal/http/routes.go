package httpapi

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

// mountDataRoutes memasang rute auth dan data (PRD bagian 9).
func (a *api) mountDataRoutes(r chi.Router, clientIP func(*http.Request) string) {
	r.Use(requireCSRFHeader)

	// Publik, dibatasi lajunya (F-01 KP6).
	authLimit := rateLimit(10, time.Minute, clientIP)
	r.With(authLimit).Post("/auth/register", a.register)
	r.With(authLimit).Post("/auth/login", a.login)
	r.With(authLimit).Get("/auth/google", a.googleStart)
	r.With(authLimit).Get("/auth/google/callback", a.googleCallback)
	r.Post("/auth/logout", a.logout)

	// Butuh sesi.
	r.Group(func(r chi.Router) {
		r.Use(a.requireAuth)

		r.Get("/me", a.getMe)
		r.Patch("/me", a.updateMe)
		r.Delete("/me", a.deleteMe)

		r.Get("/wallets", a.listWallets)
		r.Post("/wallets", a.createWallet)
		r.Patch("/wallets/{id}", a.updateWallet)

		r.Get("/categories", a.listCategories)
		r.Post("/categories", a.createCategory)
		r.Patch("/categories/{id}", a.updateCategory)
		r.With(rateLimit(120, time.Minute, clientIP)).Post("/categories/suggest", a.suggestCategory)

		r.Get("/transactions", a.listTransactions)
		r.Post("/transactions", a.createTransaction)
		r.Get("/transactions/{id}", a.getTransaction)
		r.Patch("/transactions/{id}", a.updateTransaction)
		r.Delete("/transactions/{id}", a.deleteTransaction)
		r.Post("/transactions/{id}/restore", a.restoreTransaction)

		r.Get("/reports/monthly", a.monthlyReport)
		r.Get("/budgets", a.listBudgets)
		r.Put("/budgets/{category_id}", a.putBudget)
		r.Delete("/budgets/{category_id}", a.deleteBudget)
		r.With(rateLimit(20, time.Minute, clientIP)).Get("/export/transactions.csv", a.exportCSV)
	})
}
