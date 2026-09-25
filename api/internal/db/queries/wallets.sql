-- name: CreateWallet :one
INSERT INTO wallets (user_id, name, type, provider, initial_balance)
VALUES (@user_id, @name, @type, sqlc.narg('provider'), @initial_balance)
RETURNING *;

-- name: ListWalletsWithBalance :many
-- Saldo = saldo awal + pemasukan − pengeluaran (transaksi yang tidak dihapus).
SELECT w.*,
       (w.initial_balance + COALESCE(SUM(
           CASE WHEN t.kind = 'income' THEN t.amount ELSE -t.amount END
       ), 0))::bigint AS balance
FROM wallets w
LEFT JOIN transactions t
       ON t.wallet_id = w.id AND t.user_id = w.user_id AND t.deleted_at IS NULL
WHERE w.user_id = @user_id
  AND (sqlc.arg('include_archived')::boolean OR w.archived_at IS NULL)
GROUP BY w.id
ORDER BY w.archived_at NULLS FIRST, w.created_at;

-- name: GetWalletWithBalance :one
SELECT w.*,
       (w.initial_balance + COALESCE(SUM(
           CASE WHEN t.kind = 'income' THEN t.amount ELSE -t.amount END
       ), 0))::bigint AS balance
FROM wallets w
LEFT JOIN transactions t
       ON t.wallet_id = w.id AND t.user_id = w.user_id AND t.deleted_at IS NULL
WHERE w.user_id = @user_id AND w.id = @id
GROUP BY w.id;

-- name: GetWallet :one
SELECT * FROM wallets WHERE user_id = @user_id AND id = @id;

-- name: UpdateWallet :one
UPDATE wallets
SET name = @name,
    type = @type,
    provider = sqlc.narg('provider'),
    initial_balance = @initial_balance,
    archived_at = sqlc.narg('archived_at')
WHERE user_id = @user_id AND id = @id
RETURNING *;
