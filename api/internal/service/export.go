package service

import (
	"context"
	"encoding/csv"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/Wangjarimm/Fundly/api/internal/db/store"
)

// csvSafe mencegah formula injection saat CSV dibuka di spreadsheet:
// sel yang diawali = + - @ (atau tab/CR) diberi awalan tanda kutip tunggal.
func csvSafe(s string) string {
	if s == "" {
		return s
	}
	switch s[0] {
	case '=', '+', '-', '@', '\t', '\r':
		return "'" + s
	}
	return s
}

func deref(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// ExportTransactionsCSV menulis transaksi pengguna (satu bulan, atau semua bila
// month kosong) sebagai CSV UTF-8 dengan BOM agar terbaca benar di Excel.
func (s *Service) ExportTransactionsCSV(ctx context.Context, userID uuid.UUID, month string, w io.Writer) error {
	p := store.ExportTransactionsParams{UserID: userID}
	if month != "" {
		start, end, err := s.MonthRange(month)
		if err != nil {
			return err
		}
		p.MonthStart, p.MonthEnd = &start, &end
	}
	rows, err := s.q.ExportTransactions(ctx, p)
	if err != nil {
		return err
	}
	if _, err := io.WriteString(w, "\xEF\xBB\xBF"); err != nil {
		return err
	}
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"tanggal", "jenis", "jumlah", "dompet", "kategori", "toko", "catatan", "dibuat"})
	for _, r := range rows {
		kind := "pengeluaran"
		if r.Kind == "income" {
			kind = "pemasukan"
		}
		_ = cw.Write([]string{
			r.OccurredOn.Format("2006-01-02"),
			kind,
			strconv.FormatInt(r.Amount, 10),
			csvSafe(r.WalletName),
			csvSafe(deref(r.CategoryName)),
			csvSafe(deref(r.Merchant)),
			csvSafe(strings.ReplaceAll(deref(r.Note), "\r", "")),
			r.CreatedAt.In(Jakarta).Format(time.RFC3339),
		})
	}
	cw.Flush()
	return cw.Error()
}
