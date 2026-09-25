-- +goose Up
-- Pengaturan per pengguna untuk kategori bawaan (disembunyikan / urutan),
-- karena baris kategori bawaan dipakai bersama semua pengguna.
CREATE TABLE user_category_settings (
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    hidden      BOOLEAN NOT NULL DEFAULT false,
    sort_order  INT NULL,
    PRIMARY KEY (user_id, category_id)
);
ALTER TABLE user_category_settings ENABLE ROW LEVEL SECURITY;

-- Satu aturan pribadi per kata kunci per pengguna (dipakai upsert saat koreksi).
CREATE UNIQUE INDEX category_rules_user_keyword_uq
    ON category_rules (user_id, keyword) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX category_rules_system_keyword_uq
    ON category_rules (keyword, category_id) WHERE user_id IS NULL;
CREATE UNIQUE INDEX categories_system_name_kind_uq
    ON categories (name, kind) WHERE user_id IS NULL;

-- Kategori bawaan (PRD Lampiran A). Ikon = nama ikon Lucide, warna = token DESIGN.md.
INSERT INTO categories (user_id, name, kind, icon, color_token, sort_order) VALUES
    (NULL, 'Makanan',      'expense', 'utensils',        'expense-container', 10),
    (NULL, 'Belanja',      'expense', 'shopping-basket', 'warning-container', 20),
    (NULL, 'Transport',    'expense', 'bus',             'primary-container', 30),
    (NULL, 'Tagihan',      'expense', 'receipt',         'surface-variant',   40),
    (NULL, 'Kesehatan',    'expense', 'heart-pulse',     'income-container',  50),
    (NULL, 'Pendidikan',   'expense', 'graduation-cap',  'primary-container', 60),
    (NULL, 'Hiburan',      'expense', 'clapperboard',    'warning-container', 70),
    (NULL, 'Rumah',        'expense', 'house',           'surface-variant',   80),
    (NULL, 'Keluarga',     'expense', 'users',           'income-container',  90),
    (NULL, 'Zakat/Donasi', 'expense', 'hand-heart',      'income-container', 100),
    (NULL, 'Lainnya',      'expense', 'circle-ellipsis', 'surface-variant',  110),
    (NULL, 'Gaji',         'income',  'wallet',          'income-container',  10),
    (NULL, 'Usaha',        'income',  'store',           'income-container',  20),
    (NULL, 'Hadiah',       'income',  'gift',            'warning-container', 30),
    (NULL, 'Investasi',    'income',  'trending-up',     'primary-container', 40),
    (NULL, 'Lainnya',      'income',  'circle-ellipsis', 'surface-variant',   50);

-- Aturan kata kunci bawaan (PRD bagian 10), boleh diperluas lewat migrasi baru.
INSERT INTO category_rules (user_id, keyword, category_id, priority)
SELECT NULL, r.keyword, c.id, 0
FROM (VALUES
    ('indomaret', 'Belanja', 'expense'), ('alfamart', 'Belanja', 'expense'),
    ('alfamidi', 'Belanja', 'expense'), ('supermarket', 'Belanja', 'expense'),
    ('minimarket', 'Belanja', 'expense'), ('pasar', 'Belanja', 'expense'),
    ('shopee', 'Belanja', 'expense'), ('tokopedia', 'Belanja', 'expense'),
    ('gojek', 'Transport', 'expense'), ('grab', 'Transport', 'expense'),
    ('ojek', 'Transport', 'expense'), ('bensin', 'Transport', 'expense'),
    ('pertamina', 'Transport', 'expense'), ('parkir', 'Transport', 'expense'),
    ('tol', 'Transport', 'expense'), ('krl', 'Transport', 'expense'),
    ('transjakarta', 'Transport', 'expense'), ('kereta', 'Transport', 'expense'),
    ('kopi', 'Makanan', 'expense'), ('warung', 'Makanan', 'expense'),
    ('makan', 'Makanan', 'expense'), ('resto', 'Makanan', 'expense'),
    ('gofood', 'Makanan', 'expense'), ('grabfood', 'Makanan', 'expense'),
    ('shopeefood', 'Makanan', 'expense'), ('bakso', 'Makanan', 'expense'),
    ('listrik', 'Tagihan', 'expense'), ('pln', 'Tagihan', 'expense'),
    ('pdam', 'Tagihan', 'expense'), ('internet', 'Tagihan', 'expense'),
    ('wifi', 'Tagihan', 'expense'), ('pulsa', 'Tagihan', 'expense'),
    ('bpjs', 'Kesehatan', 'expense'), ('apotek', 'Kesehatan', 'expense'),
    ('dokter', 'Kesehatan', 'expense'), ('obat', 'Kesehatan', 'expense'),
    ('spp', 'Pendidikan', 'expense'), ('kursus', 'Pendidikan', 'expense'),
    ('buku', 'Pendidikan', 'expense'),
    ('bioskop', 'Hiburan', 'expense'), ('netflix', 'Hiburan', 'expense'),
    ('spotify', 'Hiburan', 'expense'),
    ('sewa', 'Rumah', 'expense'), ('kost', 'Rumah', 'expense'),
    ('kontrakan', 'Rumah', 'expense'),
    ('zakat', 'Zakat/Donasi', 'expense'), ('infak', 'Zakat/Donasi', 'expense'),
    ('sedekah', 'Zakat/Donasi', 'expense'), ('donasi', 'Zakat/Donasi', 'expense'),
    ('gaji', 'Gaji', 'income'), ('honor', 'Gaji', 'income'),
    ('bonus', 'Gaji', 'income'), ('thr', 'Gaji', 'income'),
    ('dividen', 'Investasi', 'income')
) AS r (keyword, category_name, kind)
JOIN categories c ON c.user_id IS NULL AND c.name = r.category_name AND c.kind = r.kind;

-- +goose Down
DELETE FROM category_rules WHERE user_id IS NULL;
DELETE FROM categories WHERE user_id IS NULL;
DROP INDEX IF EXISTS categories_system_name_kind_uq;
DROP INDEX IF EXISTS category_rules_system_keyword_uq;
DROP INDEX IF EXISTS category_rules_user_keyword_uq;
DROP TABLE IF EXISTS user_category_settings;
