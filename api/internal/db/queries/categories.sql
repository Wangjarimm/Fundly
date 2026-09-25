-- name: ListCategoriesForUser :many
-- Kategori bawaan + milik pengguna, dengan pengaturan per pengguna untuk bawaan.
SELECT c.id, c.user_id, c.name, c.kind, c.icon, c.color_token,
       COALESCE(s.sort_order, c.sort_order)::int AS sort_order,
       (CASE WHEN c.user_id IS NULL THEN COALESCE(s.hidden, false) ELSE c.hidden END)::boolean AS hidden
FROM categories c
LEFT JOIN user_category_settings s ON s.category_id = c.id AND s.user_id = @user_id
WHERE (c.user_id IS NULL OR c.user_id = @user_id)
ORDER BY c.kind, COALESCE(s.sort_order, c.sort_order), c.name;

-- name: GetCategoryForUser :one
SELECT c.id, c.user_id, c.name, c.kind, c.icon, c.color_token,
       COALESCE(s.sort_order, c.sort_order)::int AS sort_order,
       (CASE WHEN c.user_id IS NULL THEN COALESCE(s.hidden, false) ELSE c.hidden END)::boolean AS hidden
FROM categories c
LEFT JOIN user_category_settings s ON s.category_id = c.id AND s.user_id = @user_id
WHERE c.id = @id AND (c.user_id IS NULL OR c.user_id = @user_id);

-- name: CreateCategory :one
INSERT INTO categories (user_id, name, kind, icon, color_token, sort_order)
VALUES (@user_id, @name, @kind, @icon, @color_token,
        COALESCE((SELECT max(sort_order) + 10 FROM categories WHERE user_id = @user_id OR user_id IS NULL), 10))
RETURNING *;

-- name: UpdateOwnCategory :one
UPDATE categories
SET name = @name, icon = @icon, color_token = @color_token,
    sort_order = @sort_order, hidden = @hidden
WHERE id = @id AND user_id = @user_id
RETURNING *;

-- name: UpsertCategorySetting :exec
INSERT INTO user_category_settings (user_id, category_id, hidden, sort_order)
VALUES (@user_id, @category_id, @hidden, sqlc.narg('sort_order'))
ON CONFLICT (user_id, category_id)
DO UPDATE SET hidden = EXCLUDED.hidden, sort_order = EXCLUDED.sort_order;

-- name: ListRulesForUser :many
-- Aturan pribadi + bawaan untuk kategori yang tidak disembunyikan pengguna.
SELECT r.id, r.user_id, r.keyword, r.category_id, r.priority, c.kind
FROM category_rules r
JOIN categories c ON c.id = r.category_id
LEFT JOIN user_category_settings s ON s.category_id = c.id AND s.user_id = @user_id
WHERE (r.user_id IS NULL OR r.user_id = @user_id)
  AND (c.user_id IS NULL OR c.user_id = @user_id)
  AND NOT (CASE WHEN c.user_id IS NULL THEN COALESCE(s.hidden, false) ELSE c.hidden END);

-- name: UpsertUserRule :exec
INSERT INTO category_rules (user_id, keyword, category_id, priority)
VALUES (@user_id, @keyword, @category_id, 0)
ON CONFLICT (user_id, keyword) WHERE user_id IS NOT NULL
DO UPDATE SET category_id = EXCLUDED.category_id;
