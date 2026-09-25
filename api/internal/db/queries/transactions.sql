-- name: CreateTransaction :one
-- Idempoten: bila client_id sudah ada untuk pengguna ini, tidak ada baris yang
-- dikembalikan (pgx.ErrNoRows) dan pemanggil mengambil transaksi yang ada.
INSERT INTO transactions (user_id, wallet_id, category_id, kind, amount, occurred_on, merchant, note, client_id)
VALUES (@user_id, @wallet_id, sqlc.narg('category_id'), @kind, @amount, @occurred_on,
        sqlc.narg('merchant'), sqlc.narg('note'), sqlc.narg('client_id'))
ON CONFLICT (user_id, client_id) DO NOTHING
RETURNING *;

-- name: GetTransactionByClientID :one
SELECT * FROM transactions WHERE user_id = @user_id AND client_id = @client_id;

-- name: GetTransaction :one
SELECT * FROM transactions WHERE user_id = @user_id AND id = @id AND deleted_at IS NULL;

-- name: UpdateTransaction :one
UPDATE transactions
SET wallet_id = @wallet_id,
    category_id = sqlc.narg('category_id'),
    kind = @kind,
    amount = @amount,
    occurred_on = @occurred_on,
    merchant = sqlc.narg('merchant'),
    note = sqlc.narg('note'),
    updated_at = now()
WHERE user_id = @user_id AND id = @id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteTransaction :execrows
UPDATE transactions SET deleted_at = now(), updated_at = now()
WHERE user_id = @user_id AND id = @id AND deleted_at IS NULL;

-- name: RestoreTransaction :one
UPDATE transactions SET deleted_at = NULL, updated_at = now()
WHERE user_id = @user_id AND id = @id AND deleted_at IS NOT NULL
RETURNING *;

-- name: ListTransactions :many
-- Paginasi kursor (occurred_on, created_at, id) menurun. Filter opsional.
SELECT * FROM transactions
WHERE user_id = @user_id
  AND deleted_at IS NULL
  AND occurred_on >= @month_start AND occurred_on < @month_end
  AND (sqlc.narg('wallet_id')::uuid IS NULL OR wallet_id = sqlc.narg('wallet_id')::uuid)
  AND (sqlc.narg('category_id')::uuid IS NULL OR category_id = sqlc.narg('category_id')::uuid)
  AND (sqlc.narg('kind')::text IS NULL OR kind = sqlc.narg('kind')::text)
  AND (sqlc.narg('q')::text IS NULL
       OR merchant ILIKE '%' || sqlc.narg('q')::text || '%' ESCAPE '\'
       OR note ILIKE '%' || sqlc.narg('q')::text || '%' ESCAPE '\')
  AND (sqlc.narg('cursor_date')::date IS NULL
       OR (occurred_on, created_at, id) < (sqlc.narg('cursor_date')::date,
                                           sqlc.narg('cursor_created')::timestamptz,
                                           sqlc.narg('cursor_id')::uuid))
ORDER BY occurred_on DESC, created_at DESC, id DESC
LIMIT @row_limit;
