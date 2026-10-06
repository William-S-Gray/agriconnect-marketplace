-- Hardening pass: session rotation bookkeeping, TOTP replay markers, and
-- search/listing indexes.

-- ─── Sessions: rotate on age, tolerate a concurrent rotation ──────────────────
-- rotated_at drives rotation. last_used_at used to, which meant an active
-- session (touched every few minutes) never rotated at all.
-- prev_token_hash keeps the previous token valid for a short grace period, so
-- two requests racing through a rotation cannot log the user out.
ALTER TABLE sessions ADD COLUMN rotated_at      TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE sessions ADD COLUMN prev_token_hash TEXT;
CREATE INDEX sessions_prev_token_hash_idx ON sessions(prev_token_hash) WHERE prev_token_hash IS NOT NULL;

-- ─── TOTP replay markers get their own table ──────────────────────────────────
-- They used to be written into mfa_recovery_codes, which mixed two kinds of
-- secret in one table and grew it on every MFA login.
CREATE TABLE mfa_used_totp (
  user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT        NOT NULL,
  used_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, code_hash)
);
-- The old markers were inserted already used; real recovery codes start unused.
DELETE FROM mfa_recovery_codes WHERE used_at IS NOT NULL AND used_at = created_at;

-- ─── Listings: the browse query's access paths ────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX listings_title_trgm_idx        ON listings USING gin (title gin_trgm_ops);
CREATE INDEX listings_produce_type_trgm_idx ON listings USING gin (produce_type gin_trgm_ops);
CREATE INDEX listings_status_created_idx    ON listings(status, created_at DESC);
