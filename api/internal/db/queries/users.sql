-- name: CreateUser :one
INSERT INTO users (email, password_hash, google_sub, display_name)
VALUES (@email, sqlc.narg('password_hash'), sqlc.narg('google_sub'), @display_name)
RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = @id;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = @email;

-- name: GetUserByGoogleSub :one
SELECT * FROM users WHERE google_sub = @google_sub;

-- name: LinkGoogleAccount :one
-- Menautkan akun Google ke akun email yang sudah ada. Password dihapus karena
-- email tidak pernah diverifikasi saat daftar; kepemilikan email baru terbukti
-- lewat Google (mencegah pengambilalihan akun oleh pendaftar lebih dulu).
UPDATE users SET google_sub = @google_sub, password_hash = NULL
WHERE id = @id
RETURNING *;

-- name: UpdateUserProfile :one
UPDATE users
SET display_name = COALESCE(sqlc.narg('display_name'), display_name),
    theme = COALESCE(sqlc.narg('theme'), theme)
WHERE id = @id
RETURNING *;

-- name: UpdateUserPassword :exec
UPDATE users SET password_hash = @password_hash WHERE id = @id;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = @id;
