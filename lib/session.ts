import 'server-only';
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'crypto';
import { sql, type Role, type UserRow } from './db';
import { observeSessionLocation } from './anomaly-monitor';
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
/** How long the pre-rotation token keeps working, for requests already in flight. */
const ROTATION_GRACE_MS = 1000 * 60 * 10;
/** Sliding the idle window more often than this is a write per request for nothing. */
const TOUCH_INTERVAL_MS = 1000 * 60 * 5;

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
  opts: {
    mfaSatisfied: boolean;
    ip?: string | null;
    userAgent?: string | null;
  },
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

  const presentedHash = hashToken(token);
  const rows = (await sql`
    SELECT s.id            AS session_id,
           s.rotated_at,
           s.token_hash    AS current_hash,
           (s.token_hash <> ${presentedHash}) AS presented_previous,
           s.mfa_satisfied,
           s.session_epoch AS session_epoch,
           s.expires_at,
           s.absolute_expires_at,
           s.revoked_at,
           s.last_used_at,
           s.last_ip,
           s.last_country,
           s.last_latitude,
           s.last_longitude,
           s.last_geo_at,
           u.id            AS user_id,
           u.email,
           u.role,
           u.status,
           u.mfa_enabled,
           u.session_epoch AS user_epoch
      FROM sessions s
      JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ${presentedHash}
        OR (s.prev_token_hash = ${presentedHash}
            AND s.rotated_at > now() - make_interval(secs => ${ROTATION_GRACE_MS / 1000}))
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

  await touchSession({
    sessionId: row.session_id as string,
    lastUsedAt: new Date(row.last_used_at as string),
    rotatedAt: new Date(row.rotated_at as string),
    absoluteExpiresAt: new Date(row.absolute_expires_at as string),
    presentedToken: token,
    presentedPrevious: row.presented_previous as boolean,
    currentHash: row.current_hash as string,
  });

  // Real-time anomaly detection, using the row already read above so an
  // unmoved session costs no extra query. Never throws — see the monitor.
  await observeSessionLocation(row.user_id as string, row.session_id as string, {
    ip: row.last_ip as string | null,
    country: row.last_country as string | null,
    latitude: row.last_latitude as number | null,
    longitude: row.last_longitude as number | null,
    at: (row.last_geo_at as Date | null) ?? null,
  });

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
 * Slides the idle window, and rotates the token once it is an hour old so a
 * captured cookie has a bounded useful life. The absolute deadline is never
 * extended.
 *
 * Rotation is a compare-and-swap on the token hash read at the start of the
 * request (exact, unlike a timestamp that loses microseconds in a JS Date):
 * when two requests race through it, exactly one wins. The loser hands the browser back the token it arrived
 * with, which stays valid for ROTATION_GRACE_MS as prev_token_hash — and a
 * request presenting that previous token rotates again, so the browser
 * converges on a live token whichever response it processed last.
 */
async function touchSession(s: {
  sessionId: string;
  lastUsedAt: Date;
  rotatedAt: Date;
  absoluteExpiresAt: Date;
  presentedToken: string;
  presentedPrevious: boolean;
  currentHash: string;
}): Promise<void> {
  const now = Date.now();
  const newIdle = new Date(Math.min(now + IDLE_TTL_MS, s.absoluteExpiresAt.getTime()));
  const rotationDue = s.presentedPrevious || now - s.rotatedAt.getTime() >= ROTATE_AFTER_MS;

  if (!rotationDue) {
    if (now - s.lastUsedAt.getTime() < TOUCH_INTERVAL_MS) return;
    await sql`
      UPDATE sessions
         SET last_used_at = now(), expires_at = ${newIdle.toISOString()}
       WHERE id = ${s.sessionId}
    `;
    return;
  }

  const rotated = randomBytes(32).toString('base64url');

  // The cookie is written BEFORE the new hash is stored, deliberately.
  //
  // Next.js forbids cookie writes while a server component renders, and that
  // throw arrives after the UPDATE if the order is reversed — leaving the
  // database holding a hash of a token the browser was never given. Writing
  // the cookie first means a read-only context fails before anything is
  // persisted.
  try {
    cookies().set(sessionCookieName(), rotated, cookieOptions(s.absoluteExpiresAt));
  } catch {
    // Read-only context (a page render). Slide the idle window so the session
    // stays alive, but leave rotated_at untouched: rotation stays owed, and the
    // next request that CAN set cookies performs it.
    await sql`
      UPDATE sessions
         SET last_used_at = now(), expires_at = ${newIdle.toISOString()}
       WHERE id = ${s.sessionId}
    `;
    return;
  }

  const won = await sql`
    UPDATE sessions
       SET prev_token_hash = ${hashToken(s.presentedToken)},
           token_hash      = ${hashToken(rotated)},
           rotated_at      = now(),
           last_used_at    = now(),
           expires_at      = ${newIdle.toISOString()}
     WHERE id = ${s.sessionId}
       AND token_hash = ${s.currentHash}
     RETURNING id
  `;
  if (won.length === 0) {
    // Lost the race: another request already rotated. Give the browser back
    // the token it sent, still honoured during the grace period.
    cookies().set(sessionCookieName(), s.presentedToken, cookieOptions(s.absoluteExpiresAt));
  }
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
  // One statement, so the epoch bump and the revocation commit together.
  await sql`
    WITH u AS (
      UPDATE users
         SET session_epoch = session_epoch + 1,
             password_changed_at = now(),
             updated_at = now()
       WHERE id = ${userId}
       RETURNING id
    )
    UPDATE sessions SET revoked_at = now()
     WHERE user_id IN (SELECT id FROM u) AND revoked_at IS NULL
  `;
}

/** Server-side logout: revoke the row, then clear the cookie. */
export async function destroySession(): Promise<void> {
  const token = cookies().get(sessionCookieName())?.value;
  if (token) {
    await sql`
      UPDATE sessions SET revoked_at = now()
       WHERE (token_hash = ${hashToken(token)} OR prev_token_hash = ${hashToken(token)})
         AND revoked_at IS NULL
    `;
  }
  cookies().set(sessionCookieName(), '', {
    ...cookieOptions(new Date(0)),
    maxAge: 0,
  });
}
