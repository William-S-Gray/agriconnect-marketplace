import 'server-only';
import { createHash, randomBytes } from 'crypto';
import { sql } from './db';

const TOKEN_TTL_HOURS = 24;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Issues a single-use verification token, replacing any unused one, and
 * returns the raw token for the email link. Only the hash is stored.
 */
export async function issueVerificationToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await sql`
    WITH spent AS (
      UPDATE email_verification_tokens SET used_at = now()
       WHERE user_id = ${userId} AND used_at IS NULL
    )
    INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
    VALUES (${userId}, ${hashToken(token)}, now() + make_interval(hours => ${TOKEN_TTL_HOURS}))
  `;
  return token;
}

/** The account a still-valid token belongs to, without consuming it. */
export async function peekVerificationToken(
  token: string,
): Promise<{ email: string; passwordHash: string } | null> {
  const [row] = await sql<{ email: string; password_hash: string }>`
    SELECT u.email, u.password_hash FROM email_verification_tokens t JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ${hashToken(token)} AND t.used_at IS NULL AND t.expires_at > now()
  `;
  return row ? { email: row.email, passwordHash: row.password_hash } : null;
}

/**
 * Consumes a token and marks the email verified, atomically. Returns the user
 * to sign in, or null when the token is unknown, expired or already used.
 */
export async function consumeVerificationToken(
  token: string,
): Promise<{ id: string; email: string; role: 'farmer' | 'buyer' | 'admin'; session_epoch: number; status: string } | null> {
  const [row] = await sql<{ id: string; email: string; role: 'farmer' | 'buyer' | 'admin'; session_epoch: number; status: string }>`
    WITH t AS (
      UPDATE email_verification_tokens SET used_at = now()
       WHERE token_hash = ${hashToken(token)} AND used_at IS NULL AND expires_at > now()
       RETURNING user_id
    )
    UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
     WHERE id IN (SELECT user_id FROM t)
     RETURNING id, email, role, session_epoch, status
  `;
  return row ?? null;
}
