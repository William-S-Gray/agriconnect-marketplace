import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware: a cheap first gate, NOT the authorization boundary.
 *
 * It only checks whether a session cookie is present, because the Edge runtime
 * cannot reach Argon2 or run the ownership queries. A cookie's presence proves
 * nothing about its validity or the user's role — so every protected page and
 * every route handler independently calls requireUser/requireRole, which reads
 * the session from the database and re-reads the role from the user row.
 *
 * The value here is purely UX and load: unauthenticated visitors get redirected
 * to /login without a database round trip, and API calls without a cookie get a
 * 401 without touching Postgres. Deleting this file would not open a hole.
 */

const COOKIE_NAMES = ['__Host-agri_session', 'agri_session'];

/** Page prefixes that require some session. Role is checked server-side. */
const PROTECTED_PAGE_PREFIXES = [
  '/farm',
  '/buyer/dashboard',
  '/buyer/orders',
  '/buyer/profile',
  '/admin',
];

/** API prefixes that require some session. */
const PROTECTED_API_PREFIXES = ['/api/admin', '/api/farmer', '/api/buyer', '/api/me'];

function hasSessionCookie(req: NextRequest): boolean {
  return COOKIE_NAMES.some((name) => Boolean(req.cookies.get(name)?.value));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /admin/login must stay reachable without a session.
  if (pathname === '/admin/login') return NextResponse.next();

  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isProtectedApi = PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p));

  if (!isProtectedPage && !isProtectedApi) return NextResponse.next();
  if (hasSessionCookie(req)) return NextResponse.next();

  if (isProtectedApi) {
    return NextResponse.json(
      { error: 'Authentication required.', code: 'unauthenticated' },
      { status: 401 },
    );
  }

  // Admin pages bounce to the unlisted admin login, everyone else to /login.
  const loginPath = pathname.startsWith('/admin') ? '/admin/login' : '/login';
  const url = req.nextUrl.clone();
  url.pathname = loginPath;
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip static assets and Next internals.
  matcher: ['/((?!_next/static|_next/image|favicon.svg|og-image.png|robots.txt).*)'],
};
