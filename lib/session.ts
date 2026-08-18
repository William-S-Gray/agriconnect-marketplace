import 'server-only';
import { cookies } from 'next/headers';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { sql, type Role, type UserRow } from './db';
import { useSecureCookies } from './env';

/**
 * Server-managed sessions.
 *
 * The browser holds one opaque random token in an HttpOnly cookie. It is not a
 * JWT and carries no claims, so nothing about the session can be forged or read
 * client-side. The database stores only the SHA-256 of the token, so a database
 * dump cannot be replayed as a live session.
 *
 * Two expiry clocks:
 *   * idle    — extended on use, so active users are not logged out mid-task
 *   * absolute — never extended, so a stolen token cannot live forever
 *
 * users.session_epoch is snapshotted at issue time. Bumping it (on password
 * change or reset) invalidates every existing session for that user at once.
 */

export const SESSION_COOKIE = '__Host-agri_session';
const IDLE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const ABSOLUTE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const ROTATE_AFTER_MS = 1000 * 60 * 60; // rotate the token hourly

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * `__Host-` prefixed cookies are locked to the exact origin and require Secure
 * + Path=/ + no Domain. Browsers reject them over plain http, so the prefix is
 * dropped in development where there is no TLS.
 */
export function sessionCookieName(): string {
  return useSecureCookies ? SESSION_COOKIE : 'agri_session';
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true as const,
    secure: useSecureCookies,
    sameSite: 'lax' as const, // survives top-level navigation from email links
    path: '/',
    expires,
  };
}

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED';
  mfaEnabled: boolean;
  /** Whether this session has satisfied the MFA challenge. */
  mfaSatisfied: boolean;
  sessionId: string;
}

/**
 * Issues a new session and sets the cookie. `mfaSatisfied` starts false for
 * users with MFA enabled — they hold a half-authenticated session until they
 * pass the TOTP step.
 */
export async function createSession(
  user: Pick<UserRow, 'id' | 'session_epoch'>,
  opts: { mfaSatisfied: boolean; ip?: string | null; userAgent?: string | null },
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();

  await sql`
    INSERT INTO sessions
      (user_id, token_hash, session_epoch, mfa_satisfied,
       expires_at, absolute_expires_at, ip, user_agent)
    VALUES
      (${user.id}, ${hashToken(token)}, ${user.session_epoch}, ${opts.mfaSatisfied},
       ${new Date(now + IDLE_TTL_MS).toISOString()},
       ${new Date(now + ABSOLUTE_TTL_MS).toISOString()},
       ${opts.ip ?? null}, ${opts.userAgent ?? null})
  `;

  cookies().set(
    sessionCookieName(),
    token,
    cookieOptions(new Date(now + ABSOLUTE_TTL_MS)),
  );
  return token;
}

/**
 * Resolves the current session from the cookie, or null.
 *
 * This is the only trusted source of identity. It re-reads the user's role from
 * the database on every call, so a role change or suspension takes effect
 * immediately and a client can never influence it.
 */
export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(sessionCookieName())?.value;
  if (!token) return null;

  const rows = (await sql`
    SELECT s.id            AS session_id,
           s.mfa_satisfied,
           s.session_epoch AS session_epoch,
           s.expires_at,
           s.absolute_expires_at,
           s.revoked_at,
           s.last_used_at,
           u.id            AS user_id,
           u.email,
           u.role,
           u.status,
           u.mfa_enabled,
           u.session_epoch AS user_epoch
      FROM sessions s
      JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ${hashToken(token)}
     LIMIT 1
  `) as Record<string, unknown>[];

  const row = rows[0];
  if (!row) return null;

  const now = Date.now();
  const revoked = row.revoked_at !== null;
  const idleExpired = new Date(row.expires_at as string).getTime() <= now;
  const absoluteExpired =
    new Date(row.absolute_expires_at as string).getTime() <= now;
  // A password change bumps the user's epoch, orphaning older sessions.
  const epochStale = (row.session_epoch as number) !== (row.user_epoch as number);

  if (revoked || idleExpired || absoluteExpired || epochStale) {
    await revokeSessionById(row.session_id as string);
    return null;
  }

  if (row.status === 'SUSPENDED') {
    await revokeAllSessionsForUser(row.user_id as string);
    return null;
  }

  await touchSession(
    row.session_id as string,
    new Date(row.last_used_at as string),
    new Date(row.absolute_expires_at as string),
    token,
  );

  return {
    id: row.user_id as string,
    email: row.email as string,
    role: row.role as Role,
    status: row.status as 'ACTIVE' | 'SUSPENDED',
    mfaEnabled: row.mfa_enabled as boolean,
    mfaSatisfied: row.mfa_satisfied as boolean,
    sessionId: row.session_id as string,
  };
}

/**
 * Slides the idle window, and periodically rotates the token itself so a
 * captured cookie has a bounded useful life. The absolute deadline is never
 * extended.
 */
async function touchSession(
  sessionId: string,
  lastUsedAt: Date,
  absoluteExpiresAt: Date,
  currentToken: string,
): Promise<void> {
  const now = Date.now();
  const newIdle = new Date(
    Math.min(now + IDLE_TTL_MS, absoluteExpiresAt.getTime()),
  );

  if (now - lastUsedAt.getTime() < ROTATE_AFTER_MS) {
    await sql`
      UPDATE sessions
         SET last_used_at = now(), expires_at = ${newIdle.toISOString()}
       WHERE id = ${sessionId}
    `;
    return;
  }

  const rotated = randomBytes(32).toString('base64url');
  await sql`
    UPDATE sessions
       SET token_hash   = ${hashToken(rotated)},
           last_used_at = now(),
           expires_at   = ${newIdle.toISOString()}
     WHERE id = ${sessionId}
  `;
  void currentToken;
  cookies().set(sessionCookieName(), rotated, cookieOptions(absoluteExpiresAt));
}

/** Marks this session's MFA challenge as satisfied. */
export async function markMfaSatisfied(sessionId: string): Promise<void> {
  await sql`UPDATE sessions SET mfa_satisfied = TRUE WHERE id = ${sessionId}`;
}

export async function revokeSessionById(sessionId: string): Promise<void> {
  await sql`
    UPDATE sessions SET revoked_at = now()
     WHERE id = ${sessionId} AND revoked_at IS NULL
  `;
}

/** Used on password change/reset and on suspension. */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await sql`
    UPDATE sessions SET revoked_at = now()
     WHERE user_id = ${userId} AND revoked_at IS NULL
  `;
}

/**
 * Invalidates every session for a user by bumping their epoch, then revoking
 * rows. Call after a password change or reset.
 */
export async function invalidateAllSessions(userId: string): Promise<void> {
  await sql`
    UPDATE users
       SET session_epoch = session_epoch + 1,
           password_changed_at = now(),
           updated_at = now()
     WHERE id = ${userId}
  `;
  await revokeAllSessionsForUser(userId);
}

/** Server-side logout: revoke the row, then clear the cookie. */
export async function destroySession(): Promise<void> {
  const token = cookies().get(sessionCookieName())?.value;
  if (token) {
    await sql`
      UPDATE sessions SET revoked_at = now()
       WHERE token_hash = ${hashToken(token)} AND revoked_at IS NULL
    `;
  }
  cookies().set(sessionCookieName(), '', {
    ...cookieOptions(new Date(0)),
    maxAge: 0,
  });
}

/** Timing-safe comparison for short opaque secrets (CSRF tokens, OTPs). */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
