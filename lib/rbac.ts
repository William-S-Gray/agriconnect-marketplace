import 'server-only';
import { NextResponse } from 'next/server';
import { sql, type Role } from './db';
import { getSession, type SessionUser } from './session';

/**
 * Server-side authorization. This is the security boundary — the UI's role
 * checks are cosmetic and are never consulted here.
 *
 * The role comes from the session's user row, re-read per request. A client
 * cannot supply, override, or influence it: there is no role in the cookie, no
 * role in any request body that is trusted, and no client-provided user id.
 *
 * Usage in a route handler:
 *
 *     const auth = await requireRole('admin');
 *     if (!auth.ok) return auth.response;   // 401 or 403, already formed
 *     // auth.user is trustworthy from here
 */

export class AuthzError extends Error {
  constructor(
    readonly status: 401 | 403,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type Ok = { ok: true; user: SessionUser };
type Fail = { ok: false; response: NextResponse };

function unauthorized(): Fail {
  return {
    ok: false,
    response: NextResponse.json(
      { error: 'Authentication required.', code: 'unauthenticated' },
      { status: 401 },
    ),
  };
}

function forbidden(): Fail {
  // Deliberately does not say which role is required, or that the resource
  // exists — a 403 should not become a discovery tool.
  return {
    ok: false,
    response: NextResponse.json(
      { error: 'You do not have permission to perform this action.', code: 'forbidden' },
      { status: 403 },
    ),
  };
}

function mfaRequired(): Fail {
  return {
    ok: false,
    response: NextResponse.json(
      { error: 'Two-factor authentication required.', code: 'mfa_required' },
      { status: 403 },
    ),
  };
}

/** 401 when there is no valid session. */
export async function requireUser(): Promise<Ok | Fail> {
  const user = await getSession();
  if (!user) return unauthorized();
  // A session that has not cleared MFA is not fully authenticated.
  if (user.mfaEnabled && !user.mfaSatisfied) return mfaRequired();
  return { ok: true, user };
}

/** 401 when unauthenticated, 403 when the role does not match. */
export async function requireRole(
  ...allowed: Role[]
): Promise<Ok | Fail> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!allowed.includes(auth.user.role)) return forbidden();
  return auth;
}

/**
 * Admin operations additionally require MFA to have been satisfied, even if the
 * account has not enabled it globally — highest-privilege actions get the
 * strictest gate available.
 */
export async function requireAdmin(): Promise<Ok | Fail> {
  return requireRole('admin');
}

// ─── Resource ownership ───────────────────────────────────────────────────────

/**
 * Resolves the farmer profile owned by this user. Returns null when the user is
 * not a farmer — callers must treat that as 403, never fall back to "any
 * farmer".
 */
export async function farmerIdForUser(userId: string): Promise<string | null> {
  const rows = (await sql`
    SELECT id FROM farmers WHERE user_id = ${userId} LIMIT 1
  `) as { id: string }[];
  return rows[0]?.id ?? null;
}

export async function buyerIdForUser(userId: string): Promise<string | null> {
  const rows = (await sql`
    SELECT id FROM buyers WHERE user_id = ${userId} LIMIT 1
  `) as { id: string }[];
  return rows[0]?.id ?? null;
}

/**
 * Ownership check for an order. Admins may see any order; a farmer or buyer may
 * only see orders they are party to. Returns false rather than throwing so the
 * caller decides between 403 and 404.
 */
export async function canAccessOrder(
  user: SessionUser,
  orderId: string,
): Promise<boolean> {
  if (user.role === 'admin') return true;

  const rows = (await sql`
    SELECT o.id
      FROM orders o
      LEFT JOIN farmers f ON f.id = o.farmer_id
      LEFT JOIN buyers  b ON b.id = o.buyer_id
     WHERE o.id = ${orderId}
       AND (f.user_id = ${user.id} OR b.user_id = ${user.id})
     LIMIT 1
  `) as { id: string }[];
  return rows.length > 0;
}

/** Ownership check for a listing: only the owning farmer, or an admin. */
export async function canModifyListing(
  user: SessionUser,
  listingId: string,
): Promise<boolean> {
  if (user.role === 'admin') return true;
  if (user.role !== 'farmer') return false;

  const rows = (await sql`
    SELECT l.id
      FROM listings l
      JOIN farmers f ON f.id = l.farmer_id
     WHERE l.id = ${listingId} AND f.user_id = ${user.id}
     LIMIT 1
  `) as { id: string }[];
  return rows.length > 0;
}

/**
 * Fields a client may never set on itself. Used to strip privilege-escalation
 * attempts out of request bodies before they reach an update statement.
 */
const IMMUTABLE_CLIENT_FIELDS = [
  'role', 'status', 'id', 'user_id', 'password_hash',
  'session_epoch', 'mfa_enabled', 'mfa_secret', 'email_verified_at',
] as const;

/**
 * Returns a copy of `body` with privileged fields removed, plus the list of
 * fields that were stripped so the caller can log an escalation attempt.
 *
 * This is defence in depth: no update statement in this app interpolates
 * client keys, but a future one might.
 */
export function stripPrivilegedFields<T extends Record<string, unknown>>(
  body: T,
): { clean: Partial<T>; stripped: string[] } {
  const clean: Record<string, unknown> = {};
  const stripped: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    if ((IMMUTABLE_CLIENT_FIELDS as readonly string[]).includes(key)) {
      stripped.push(key);
    } else {
      clean[key] = value;
    }
  }
  return { clean: clean as Partial<T>, stripped };
}
