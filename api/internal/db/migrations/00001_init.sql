-- +goose Up
-- Skema awal Fundly (PRD bagian 8).
-- Setiap tabel langsung ENABLE ROW LEVEL SECURITY tanpa policy (D-12):
-- akses lewat Data API Supabase dengan kunci publik ditolak, sementara backend
-- terhubung sebagai pemilik tabel sehingga tidak terkena RLS.

CREATE EXTENSION IF NOT EXISTS citext;

-- Tabel versi milik goose juga berada di skema public, jadi ikut dikunci.
-- Dibungkus DO agar sqlc (yang tidak mengenal tabel ini) melewatinya.
-- +goose StatementBegin
DO $$
BEGIN
    EXECUTE 'ALTER TABLE goose_db_version ENABLE ROW LEVEL SECURITY';
END
$$;
-- +goose StatementEnd

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         CITEXT NOT NULL UNIQUE,
    password_hash TEXT NULL,
    google_sub    TEXT NULL UNIQUE,
    display_name  TEXT NOT NULL DEFAULT '',
    theme         TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE TABLE sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,
    expires_at   TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX sessions_user_id_idx ON sessions (user_id);

CREATE TABLE wallets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'ewallet', 'other')),
    provider        TEXT NULL,
    initial_balance BIGINT NOT NULL DEFAULT 0,
    archived_at     TIMESTAMPTZ NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
CREATE INDEX wallets_user_id_idx ON wallets (user_id);

CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NULL REFERENCES users (id) ON DELETE CASCADE, -- NULL = kategori bawaan
    name        TEXT NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
    icon        TEXT NOT NULL DEFAULT '',
    color_token TEXT NOT NULL DEFAULT '',
    sort_order  INT NOT NULL DEFAULT 0,
    hidden      BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE INDEX categories_user_id_idx ON categories (user_id);

CREATE TABLE transactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    wallet_id   UUID NOT NULL REFERENCES wallets (id) ON DELETE CASCADE,
    category_id UUID NULL REFERENCES categories (id) ON DELETE SET NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
    amount      BIGINT NOT NULL CHECK (amount > 0),
    occurred_on DATE NOT NULL,
    merchant    TEXT NULL,
    note        TEXT NULL,
    source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'receipt', 'import')),
    client_id   UUID NULL, -- kunci idempoten dari klien
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ NULL,
    UNIQUE (user_id, client_id)
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX transactions_user_occurred_idx ON transactions (user_id, occurred_on DESC);
CREATE INDEX transactions_user_category_occurred_idx ON transactions (user_id, category_id, occurred_on);
CREATE INDEX transactions_user_wallet_idx ON transactions (user_id, wallet_id);

CREATE TABLE budgets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    category_id  UUID NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    month        DATE NOT NULL CHECK (EXTRACT(DAY FROM month) = 1), -- tanggal 1 bulan tsb
    limit_amount BIGINT NOT NULL CHECK (limit_amount >= 0),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, category_id, month)
);
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE TABLE category_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NULL REFERENCES users (id) ON DELETE CASCADE, -- NULL = aturan bawaan
    keyword     TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    priority    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;
CREATE INDEX category_rules_user_id_idx ON category_rules (user_id);

-- +goose Down
DROP TABLE IF EXISTS category_rules;
DROP TABLE IF EXISTS budgets;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS wallets;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
