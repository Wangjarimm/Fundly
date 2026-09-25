-- +goose Up
-- F-06 KP3: anggaran bulan baru menyalin bulan lalu, bisa dimatikan per pengguna.
-- Aditif (kolom baru dengan default) agar aman untuk kode versi lama maupun baru.
ALTER TABLE users ADD COLUMN budget_auto_copy BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX budgets_user_month_idx ON budgets (user_id, month);

-- +goose Down
DROP INDEX IF EXISTS budgets_user_month_idx;
ALTER TABLE users DROP COLUMN IF EXISTS budget_auto_copy;
