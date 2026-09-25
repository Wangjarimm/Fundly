-- name: CreateSession :one
INSERT INTO sessions (user_id, token_hash, expires_at)
VALUES (@user_id, @token_hash, @expires_at)
RETURNING *;

-- name: GetSessionByTokenHash :one
SELECT s.id AS session_id, s.expires_at, s.last_seen_at, u.*
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.token_hash = @token_hash AND s.expires_at > now();

-- name: TouchSession :exec
UPDATE sessions SET last_seen_at = now(), expires_at = @expires_at WHERE id = @id;

-- name: DeleteSessionByTokenHash :exec
DELETE FROM sessions WHERE token_hash = @token_hash;

-- name: DeleteOtherSessions :exec
DELETE FROM sessions WHERE user_id = @user_id AND id <> @keep_id;

-- name: DeleteExpiredSessions :exec
DELETE FROM sessions WHERE user_id = @user_id AND expires_at <= now();
