package service

import (
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/Wangjarimm/Fundly/api/internal/db/store"
)

// TransactionInput dipakai untuk membuat atau mengubah transaksi; nil = tidak diubah.
type TransactionInput struct {
	WalletID   *uuid.UUID
	CategoryID **uuid.UUID // nil = tidak diubah, &nil = kosongkan
	Kind       *string
	Amount     *int64
	OccurredOn *time.Time
	Merchant   **string
	Note       **string
	ClientID   *uuid.UUID
}

func (s *Service) validateAmountDate(amount int64, on time.Time) error {
	if amount <= 0 {
		return invalid("Jumlah harus lebih dari 0. Ketik angka lalu simpan.")
	}
	if amount > MaxAmount {
		return invalid("Jumlah terlalu besar.")
	}
	if on.Year() < 2000 || on.After(s.Today().AddDate(1, 0, 0)) {
		return invalid("Tanggal transaksi di luar rentang yang diizinkan.")
	}
	return nil
}

// checkRefs memastikan dompet dan kategori milik pengguna dan cocok jenisnya.
func (s *Service) checkRefs(ctx context.Context, userID, walletID uuid.UUID, walletChanged bool, categoryID *uuid.UUID, kind string) error {
	w, err := s.q.GetWallet(ctx, store.GetWalletParams{UserID: userID, ID: walletID})
	if isNoRows(err) {
		return invalid("Dompet tidak ditemukan.")
	}
	if err != nil {
		return err
	}
	if walletChanged && w.ArchivedAt != nil {
		return invalid("Dompet ini sudah diarsipkan. Pilih dompet lain.")
	}
	if categoryID != nil {
		c, err := s.GetCategory(ctx, userID, *categoryID)
		if errors.Is(err, ErrNotFound) {
			return invalid("Kategori tidak ditemukan.")
		}
		if err != nil {
			return err
		}
		if c.Kind != kind {
			return invalid("Kategori tidak sesuai dengan jenis transaksi.")
		}
	}
	return nil
}

// CreateTransaction mencatat transaksi (F-03). Idempoten lewat client_id:
// created=false berarti transaksi dengan client_id yang sama sudah ada.
func (s *Service) CreateTransaction(ctx context.Context, userID uuid.UUID, in TransactionInput) (tx store.Transaction, created bool, err error) {
	if in.WalletID == nil || in.Kind == nil || in.Amount == nil || in.OccurredOn == nil {
		return tx, false, invalid("Dompet, jenis, jumlah, dan tanggal wajib diisi.")
	}
	if !validKind(*in.Kind) {
		return tx, false, invalid("Jenis harus expense atau income.")
	}
	if err := s.validateAmountDate(*in.Amount, *in.OccurredOn); err != nil {
		return tx, false, err
	}
	var categoryID *uuid.UUID
	if in.CategoryID != nil {
		categoryID = *in.CategoryID
	}
	merchant, note, err := cleanMerchantNote(in.Merchant, in.Note, nil, nil)
	if err != nil {
		return tx, false, err
	}

	if in.ClientID != nil {
		existing, err := s.q.GetTransactionByClientID(ctx, store.GetTransactionByClientIDParams{UserID: userID, ClientID: in.ClientID})
		if err == nil {
			return existing, false, nil
		}
		if !isNoRows(err) {
			return tx, false, err
		}
	}
	if err := s.checkRefs(ctx, userID, *in.WalletID, true, categoryID, *in.Kind); err != nil {
		return tx, false, err
	}

	tx, err = s.q.CreateTransaction(ctx, store.CreateTransactionParams{
		UserID: userID, WalletID: *in.WalletID, CategoryID: categoryID, Kind: *in.Kind,
		Amount: *in.Amount, OccurredOn: *in.OccurredOn, Merchant: merchant, Note: note, ClientID: in.ClientID,
	})
	if isNoRows(err) && in.ClientID != nil {
		// Balapan dua permintaan dengan client_id sama: ambil yang sudah tersimpan.
		existing, err := s.q.GetTransactionByClientID(ctx, store.GetTransactionByClientIDParams{UserID: userID, ClientID: in.ClientID})
		return existing, false, err
	}
	if err != nil {
		return tx, false, err
	}
	if err := s.learnFromCorrection(ctx, userID, merchant, categoryID, *in.Kind); err != nil {
		return tx, true, err
	}
	return tx, true, nil
}

func cleanMerchantNote(merchant, note **string, curMerchant, curNote *string) (*string, *string, error) {
	m, n := curMerchant, curNote
	var err error
	if merchant != nil {
		if m, err = cleanOptional(*merchant, 120, "Nama toko"); err != nil {
			return nil, nil, err
		}
	}
	if note != nil {
		if n, err = cleanOptional(*note, 500, "Catatan"); err != nil {
			return nil, nil, err
		}
	}
	return m, n, nil
}

// GetTransaction mengambil satu transaksi milik pengguna.
func (s *Service) GetTransaction(ctx context.Context, userID, id uuid.UUID) (store.Transaction, error) {
	tx, err := s.q.GetTransaction(ctx, store.GetTransactionParams{UserID: userID, ID: id})
	if isNoRows(err) {
		return tx, ErrNotFound
	}
	return tx, err
}

// UpdateTransaction mengubah transaksi (F-03 KP5).
func (s *Service) UpdateTransaction(ctx context.Context, userID, id uuid.UUID, in TransactionInput) (store.Transaction, error) {
	cur, err := s.GetTransaction(ctx, userID, id)
	if err != nil {
		return cur, err
	}
	p := store.UpdateTransactionParams{
		WalletID: cur.WalletID, CategoryID: cur.CategoryID, Kind: cur.Kind, Amount: cur.Amount,
		OccurredOn: cur.OccurredOn, Merchant: cur.Merchant, Note: cur.Note, UserID: userID, ID: id,
	}
	walletChanged := in.WalletID != nil && *in.WalletID != cur.WalletID
	if in.WalletID != nil {
		p.WalletID = *in.WalletID
	}
	categoryChanged := in.CategoryID != nil
	if in.CategoryID != nil {
		p.CategoryID = *in.CategoryID
	}
	if in.Kind != nil {
		if !validKind(*in.Kind) {
			return cur, invalid("Jenis harus expense atau income.")
		}
		if *in.Kind != cur.Kind && !categoryChanged {
			p.CategoryID = nil // kategori lama tidak cocok dengan jenis baru
		}
		p.Kind = *in.Kind
	}
	if in.Amount != nil {
		p.Amount = *in.Amount
	}
	if in.OccurredOn != nil {
		p.OccurredOn = *in.OccurredOn
	}
	if p.Merchant, p.Note, err = cleanMerchantNote(in.Merchant, in.Note, cur.Merchant, cur.Note); err != nil {
		return cur, err
	}
	if err := s.validateAmountDate(p.Amount, p.OccurredOn); err != nil {
		return cur, err
	}
	if err := s.checkRefs(ctx, userID, p.WalletID, walletChanged, p.CategoryID, p.Kind); err != nil {
		return cur, err
	}
	tx, err := s.q.UpdateTransaction(ctx, p)
	if isNoRows(err) {
		return tx, ErrNotFound
	}
	if err != nil {
		return tx, err
	}
	if categoryChanged {
		if err := s.learnFromCorrection(ctx, userID, tx.Merchant, tx.CategoryID, tx.Kind); err != nil {
			return tx, err
		}
	}
	return tx, nil
}

// DeleteTransaction menghapus transaksi secara lunak (bisa dibatalkan).
func (s *Service) DeleteTransaction(ctx context.Context, userID, id uuid.UUID) error {
	n, err := s.q.SoftDeleteTransaction(ctx, store.SoftDeleteTransactionParams{UserID: userID, ID: id})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// RestoreTransaction membatalkan penghapusan.
func (s *Service) RestoreTransaction(ctx context.Context, userID, id uuid.UUID) (store.Transaction, error) {
	tx, err := s.q.RestoreTransaction(ctx, store.RestoreTransactionParams{UserID: userID, ID: id})
	if isNoRows(err) {
		return tx, ErrNotFound
	}
	return tx, err
}

// ListTransactionsInput adalah filter daftar transaksi (F-03 KP4).
type ListTransactionsInput struct {
	Month      string
	WalletID   *uuid.UUID
	CategoryID *uuid.UUID
	Kind       *string
	Q          *string
	Cursor     string
	Limit      int
}

// ListTransactions mengembalikan satu halaman transaksi dan kursor berikutnya.
func (s *Service) ListTransactions(ctx context.Context, userID uuid.UUID, in ListTransactionsInput) ([]store.Transaction, *string, error) {
	start, end, err := s.MonthRange(in.Month)
	if err != nil {
		return nil, nil, err
	}
	limit := in.Limit
	if limit == 0 {
		limit = 50
	}
	if limit < 1 || limit > 100 {
		return nil, nil, newErr(http.StatusBadRequest, "invalid_limit", "limit harus 1–100.")
	}
	if in.Kind != nil && !validKind(*in.Kind) {
		return nil, nil, newErr(http.StatusBadRequest, "invalid_kind", "kind harus expense atau income.")
	}
	p := store.ListTransactionsParams{
		UserID: userID, MonthStart: start, MonthEnd: end, WalletID: in.WalletID,
		CategoryID: in.CategoryID, Kind: in.Kind, RowLimit: int32(limit + 1), //nolint:gosec // limit ≤ 101
	}
	if in.Q != nil {
		q := strings.TrimSpace(*in.Q)
		if len(q) > 100 {
			return nil, nil, newErr(http.StatusBadRequest, "invalid_query", "Kata pencarian terlalu panjang.")
		}
		if q != "" {
			escaped := likeEscaper.Replace(q)
			p.Q = &escaped
		}
	}
	if in.Cursor != "" {
		d, c, id, err := decodeCursor(in.Cursor)
		if err != nil {
			return nil, nil, newErr(http.StatusBadRequest, "invalid_cursor", "Kursor tidak valid.")
		}
		p.CursorDate, p.CursorCreated, p.CursorID = &d, &c, &id
	}
	rows, err := s.q.ListTransactions(ctx, p)
	if err != nil {
		return nil, nil, err
	}
	var next *string
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[len(rows)-1]
		c := encodeCursor(last.OccurredOn, last.CreatedAt, last.ID)
		next = &c
	}
	return rows, next, nil
}

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

func encodeCursor(on, created time.Time, id uuid.UUID) string {
	raw := on.Format("2006-01-02") + "|" + strconv.FormatInt(created.UnixMicro(), 10) + "|" + id.String()
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeCursor(c string) (time.Time, time.Time, uuid.UUID, error) {
	raw, err := base64.RawURLEncoding.DecodeString(c)
	if err != nil {
		return time.Time{}, time.Time{}, uuid.Nil, err
	}
	parts := strings.Split(string(raw), "|")
	if len(parts) != 3 {
		return time.Time{}, time.Time{}, uuid.Nil, errors.New("kursor rusak")
	}
	on, err := time.Parse("2006-01-02", parts[0])
	if err != nil {
		return time.Time{}, time.Time{}, uuid.Nil, err
	}
	micros, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return time.Time{}, time.Time{}, uuid.Nil, err
	}
	id, err := uuid.Parse(parts[2])
	if err != nil {
		return time.Time{}, time.Time{}, uuid.Nil, err
	}
	return on, time.UnixMicro(micros).UTC(), id, nil
}
