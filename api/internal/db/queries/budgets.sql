-- name: ListBudgetsWithSpent :many
-- Anggaran bulan beserta pengeluaran kategori tersebut di bulan yang sama.
SELECT b.category_id, b.month, b.limit_amount,
       COALESCE((
           SELECT SUM(t.amount) FROM transactions t
           WHERE t.user_id = b.user_id AND t.category_id = b.category_id
             AND t.kind = 'expense' AND t.deleted_at IS NULL
             AND t.occurred_on >= b.month AND t.occurred_on < (b.month + interval '1 month')
       ), 0)::bigint AS spent
FROM budgets b
WHERE b.user_id = @user_id AND b.month = @month
ORDER BY b.created_at;

-- name: CountBudgets :one
SELECT count(*) FROM budgets WHERE user_id = @user_id AND month = @month;

-- name: CopyBudgets :execrows
-- Salin anggaran dari bulan sumber ke bulan tujuan (F-06 KP3). Tidak menimpa.
INSERT INTO budgets (user_id, category_id, month, limit_amount)
SELECT src.user_id, src.category_id, @to_month::date, src.limit_amount
FROM budgets src
WHERE src.user_id = @user_id AND src.month = @from_month::date
ON CONFLICT (user_id, category_id, month) DO NOTHING;

-- name: UpsertBudget :exec
INSERT INTO budgets (user_id, category_id, month, limit_amount)
VALUES (@user_id, @category_id, @month, @limit_amount)
ON CONFLICT (user_id, category_id, month) DO UPDATE SET limit_amount = EXCLUDED.limit_amount;

-- name: DeleteBudget :execrows
DELETE FROM budgets WHERE user_id = @user_id AND category_id = @category_id AND month = @month;
