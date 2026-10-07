-- Email verification for new accounts.
--
-- Tokens are stored hashed, expire, and are single-use, like password-reset
-- tokens. Accounts that already exist are treated as verified, so turning
-- verification on never locks out a current user.

CREATE TABLE email_verification_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_verification_tokens_user_id_idx ON email_verification_tokens(user_id);

UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;
