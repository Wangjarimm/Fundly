-- Agregat dihitung di SQL, bukan di memori aplikasi (PRD bagian 7).

-- name: MonthTotals :one
SELECT
    COALESCE(SUM(CASE WHEN kind = 'income' THEN amount END), 0)::bigint AS income,
    COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount END), 0)::bigint AS expense
FROM transactions
WHERE user_id = @user_id AND deleted_at IS NULL
  AND occurred_on >= @month_start AND occurred_on < @month_end;

-- name: ExpenseByCategory :many
-- Pengeluaran per kategori, terbesar dulu. category_id NULL = tanpa kategori.
SELECT t.category_id, c.name AS category_name, SUM(t.amount)::bigint AS amount
FROM transactions t
LEFT JOIN categories c ON c.id = t.category_id
WHERE t.user_id = @user_id AND t.deleted_at IS NULL AND t.kind = 'expense'
  AND t.occurred_on >= @month_start AND t.occurred_on < @month_end
GROUP BY t.category_id, c.name
ORDER BY amount DESC, c.name;

-- name: DailySeries :many
-- Seri harian lengkap (hari tanpa transaksi = 0) untuk grafik tren.
SELECT d.day::date AS day,
       COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.amount END), 0)::bigint AS income,
       COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.amount END), 0)::bigint AS expense
FROM generate_series(@month_start::date, @last_day::date, interval '1 day') AS d(day)
LEFT JOIN transactions t
       ON t.occurred_on = d.day::date AND t.user_id = @user_id AND t.deleted_at IS NULL
GROUP BY d.day
ORDER BY d.day;
