-- name: ExportTransactions :many
-- Semua transaksi (atau satu bulan) milik pengguna untuk ekspor CSV (F-05 KP6, F-08 KP2).
SELECT t.occurred_on, t.kind, t.amount, w.name AS wallet_name,
       c.name AS category_name, t.merchant, t.note, t.created_at
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
LEFT JOIN categories c ON c.id = t.category_id
WHERE t.user_id = @user_id AND t.deleted_at IS NULL
  AND (sqlc.narg('month_start')::date IS NULL OR t.occurred_on >= sqlc.narg('month_start')::date)
  AND (sqlc.narg('month_end')::date IS NULL OR t.occurred_on < sqlc.narg('month_end')::date)
ORDER BY t.occurred_on, t.created_at;
