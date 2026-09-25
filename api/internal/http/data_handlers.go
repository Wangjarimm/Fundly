package httpapi

import (
	"net/http"
	"strconv"
	"time"

	"github.com/Wangjarimm/Fundly/api/internal/http/apigen"
	"github.com/Wangjarimm/Fundly/api/internal/service"
)

type listResponse[T any] struct {
	Items []T `json:"items"`
}

// --- Dompet ---

func (a *api) listWallets(w http.ResponseWriter, r *http.Request) {
	p := principalFrom(r.Context())
	ws, err := a.svc.ListWallets(r.Context(), p.User.ID, queryBool(r, "include_archived"))
	if err != nil {
		a.fail(w, r, err)
		return
	}
	items := make([]apigen.Wallet, 0, len(ws))
	for _, x := range ws {
		items = append(items, toWallet(x))
	}
	writeJSON(w, http.StatusOK, listResponse[apigen.Wallet]{Items: items})
}

func (a *api) createWallet(w http.ResponseWriter, r *http.Request) {
	var body apigen.WalletCreate
	if !decodeJSON(w, r, &body) {
		return
	}
	t := string(body.Type)
	in := service.WalletInput{Name: &body.Name, Type: &t, Provider: patchOf(body.Provider), InitialBalance: body.InitialBalance}
	wl, err := a.svc.CreateWallet(r.Context(), principalFrom(r.Context()).User.ID, in)
	if err != nil {
		a.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, toWallet(wl))
}

func (a *api) updateWallet(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var body apigen.WalletUpdate
	if !decodeJSON(w, r, &body) {
		return
	}
	in := service.WalletInput{
		Name: body.Name, Provider: patchOf(body.Provider), InitialBalance: body.InitialBalance, Archived: body.Archived,
	}
	if body.Type != nil {
		t := string(*body.Type)
		in.Type = &t
	}
	wl, err := a.svc.UpdateWallet(r.Context(), principalFrom(r.Context()).User.ID, id, in)
	if err != nil {
		a.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toWallet(wl))
}

// --- Kategori ---

func (a *api) listCategories(w http.ResponseWriter, r *http.Request) {
	cs, err := a.svc.ListCategories(r.Context(), principalFrom(r.Context()).User.ID,
		r.URL.Query().Get("kind"), queryBool(r, "include_hidden"))
	if err != nil {
		a.fail(w, r, err)
		return
	}
	items := make([]apigen.Category, 0, len(cs))
	for _, c := range cs {
		items = append(items, toCategory(c))
	}
	writeJSON(w, http.StatusOK, listResponse[apigen.Category]{Items: items})
}

func (a *api) createCategory(w http.ResponseWriter, r *http.Request) {
	var body apigen.CategoryCreate
	if !decodeJSON(w, r, &body) {
		return
	}
	k := string(body.Kind)
	c, err := a.svc.CreateCategory(r.Context(), principalFrom(r.Context()).User.ID, service.CategoryInput{
		Name: &body.Name, Kind: &k, Icon: body.Icon, ColorToken: body.ColorToken,
	})
	if err != nil {
		a.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, toCategory(c))
}

func (a *api) updateCategory(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var body apigen.CategoryUpdate
	if !decodeJSON(w, r, &body) {
		return
	}
	in := service.CategoryInput{Name: body.Name, Icon: body.Icon, ColorToken: body.ColorToken, Hidden: body.Hidden}
	if body.SortOrder != nil {
		if *body.SortOrder < -1_000_000 || *body.SortOrder > 1_000_000 {
			writeError(w, http.StatusUnprocessableEntity, "validation_failed", "Urutan di luar rentang.")
			return
		}
		so := int32(*body.SortOrder) //nolint:gosec // rentang sudah dibatasi
		in.SortOrder = &so
	}
	c, err := a.svc.UpdateCategory(r.Context(), principalFrom(r.Context()).User.ID, id, in)
	if err != nil {
		a.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toCategory(c))
}

type suggestResponse struct {
	CategoryID *string `json:"category_id"`
	Confidence float64 `json:"confidence"`
}

func (a *api) suggestCategory(w http.ResponseWriter, r *http.Request) {
	var body apigen.SuggestCategoryJSONBody
	if !decodeJSON(w, r, &body) {
		return
	}
	kind := ""
	if body.Kind != nil {
		kind = string(*body.Kind)
	}
	sug, err := a.svc.SuggestCategory(r.Context(), principalFrom(r.Context()).User.ID, strOf(body.Merchant), strOf(body.Note), kind)
	if err != nil {
		a.fail(w, r, err)
		return
	}
	res := suggestResponse{}
	if sug != nil {
		id := sug.CategoryID.String()
		res = suggestResponse{CategoryID: &id, Confidence: sug.Confidence}
	}
	writeJSON(w, http.StatusOK, res)
}

// --- Transaksi ---

type transactionPage struct {
	Items      []apigen.Transaction `json:"items"`
	NextCursor *string              `json:"next_cursor"`
}

func (a *api) listTransactions(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	in := service.ListTransactionsInput{Month: q.Get("month"), Cursor: q.Get("cursor")}
	var ok bool
	if in.WalletID, ok = queryUUID(w, r, "wallet_id"); !ok {
		return
	}
	if in.CategoryID, ok = queryUUID(w, r, "category_id"); !ok {
		return
	}
	if v := q.Get("kind"); v != "" {
		in.Kind = &v
	}
	if v := q.Get("q"); v != "" {
		in.Q = &v
	}
	if v := q.Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid_limit", "limit harus angka 1–100.")
			return
		}
		in.Limit = n
	}
	txs, next, err := a.svc.ListTransactions(r.Context(), principalFrom(r.Context()).User.ID, in)
	if err != nil {
		a.fail(w, r, err)
		return
	}
	items := make([]apigen.Transaction, 0, len(txs))
	for _, t := range txs {
		items = append(items, toTransaction(t))
	}
	writeJSON(w, http.StatusOK, transactionPage{Items: items, NextCursor: next})
}

func (a *api) createTransaction(w http.ResponseWriter, r *http.Request) {
	var body apigen.TransactionCreate
	if !decodeJSON(w, r, &body) {
		return
	}
	k := string(body.Kind)
	on := body.OccurredOn.Time
	in := service.TransactionInput{
		WalletID: &body.WalletId, Kind: &k, Amount: &body.Amount, OccurredOn: &on,
		CategoryID: patchOf(body.CategoryId), Merchant: patchOf(body.Merchant), Note: patchOf(body.Note),
	}
	if cid := patchOf(body.ClientId); cid != nil {
		in.ClientID = *cid
	}
	tx, created, err := a.svc.CreateTransaction(r.Context(), principalFrom(r.Context()).User.ID, in)
	if err != nil {
		a.fail(w, r, err)
		return
	}
	status := http.StatusCreated
	if !created {
		status = http.StatusOK
	}
	writeJSON(w, status, toTransaction(tx))
}

func (a *api) getTransaction(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	tx, err := a.svc.GetTransaction(r.Context(), principalFrom(r.Context()).User.ID, id)
	if err != nil {
		a.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toTransaction(tx))
}

func (a *api) updateTransaction(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var body apigen.TransactionUpdate
	if !decodeJSON(w, r, &body) {
		return
	}
	in := service.TransactionInput{
		WalletID: uuidPtr(body.WalletId), Amount: body.Amount,
		CategoryID: patchOf(body.CategoryId), Merchant: patchOf(body.Merchant), Note: patchOf(body.Note),
	}
	if body.Kind != nil {
		k := string(*body.Kind)
		in.Kind = &k
	}
	if body.OccurredOn != nil {
		on := time.Time(body.OccurredOn.Time)
		in.OccurredOn = &on
	}
	tx, err := a.svc.UpdateTransaction(r.Context(), principalFrom(r.Context()).User.ID, id, in)
	if err != nil {
		a.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toTransaction(tx))
}

func (a *api) deleteTransaction(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	if err := a.svc.DeleteTransaction(r.Context(), principalFrom(r.Context()).User.ID, id); err != nil {
		a.fail(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *api) restoreTransaction(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	tx, err := a.svc.RestoreTransaction(r.Context(), principalFrom(r.Context()).User.ID, id)
	if err != nil {
		a.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toTransaction(tx))
}
