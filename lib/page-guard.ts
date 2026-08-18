import 'server-only';
import { redirect } from 'next/navigation';
import { getSession, type SessionUser } from './session';
import type { Role } from './db';

/**
 * Server-side guards for pages (as opposed to route handlers).
 *
 * These run in server components before any markup is produced, so a protected
 * page's contents are never sent to an unauthorized browser — unlike the old
 * client-side ProtectedRoute, which shipped the page and then redirected.
 *
 * Middleware already bounces requests with no cookie, but that is only a cheap
 * pre-filter; these functions are the enforcement for page routes.
 */

/** Requires any fully-authenticated session, else redirects to login. */
export async function requirePageUser(nextPath?: string): Promise<SessionUser> {
  const session = await getSession();

  if (!session) {
    redirect(loginUrl('/login', nextPath));
  }
  if (session.mfaEnabled && !session.mfaSatisfied) {
    redirect('/login/mfa');
  }
  return session;
}

/**
 * Requires one of `allowed` roles. A signed-in user with the wrong role is sent
 * to their own dashboard rather than the login page — being logged in as the
 * wrong role is not an authentication failure.
 */
export async function requirePageRole(
  allowed: Role[],
  nextPath?: string,
): Promise<SessionUser> {
  const session = await getSession();

  if (!session) {
    const isAdminArea = allowed.includes('admin') && allowed.length === 1;
    redirect(loginUrl(isAdminArea ? '/admin/login' : '/login', nextPath));
  }
  if (session.mfaEnabled && !session.mfaSatisfied) {
    redirect('/login/mfa');
  }
  if (!allowed.includes(session.role)) {
    redirect(homeForRole(session.role));
  }
  return session;
}

export function homeForRole(role: Role): string {
  switch (role) {
    case 'farmer':
      return '/farm/dashboard';
    case 'buyer':
      return '/buyer/dashboard';
    case 'admin':
      return '/admin';
  }
}

function loginUrl(base: string, nextPath?: string): string {
  return nextPath ? `${base}?next=${encodeURIComponent(nextPath)}` : base;
}

/**
 * For pages that render differently when signed in but are public otherwise
 * (home, browse, listing detail). Never throws or redirects.
 */
export async function optionalPageUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.mfaEnabled && !session.mfaSatisfied) return null;
  return session;
}
