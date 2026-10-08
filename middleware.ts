import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware: a cheap first gate, NOT the authorization boundary — plus
 * the per-request Content-Security-Policy.
 *
 * Auth: it only checks whether a session cookie is present, because the Edge
 * runtime cannot reach Argon2 or run the ownership queries. A cookie's presence
 * proves nothing about its validity or the user's role — so every protected
 * page and every route handler independently calls requireUser/requireRole,
 * which reads the session from the database and re-reads the role from the user
 * row. Unauthenticated visitors get redirected to /login without a database
 * round trip, and API calls without a cookie get a 401 without touching
 * Postgres.
 *
 * CSP: the App Router emits inline <script> tags for its streamed payload, so
 * a static `script-src 'self'` blocks hydration entirely. Next reads the nonce
 * out of the *request* CSP header and stamps it on those scripts; the layout
 * reads `x-nonce` for its own inline theme script. Both request headers are
 * always overwritten here, so a client-supplied value never reaches rendering.
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

export function contentSecurityPolicy(nonce: string, isProd: boolean): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonced bootstrap load Next's chunks; 'self' is
    // the fallback for browsers without strict-dynamic support.
    isProd
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    // Listing photos are served from Vercel Blob and uploaded to its API
    // directly from the browser (lib/listing-photos.ts).
    "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
    "font-src 'self' data:",
    "connect-src 'self' https://vercel.com https://*.blob.vercel-storage.com",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(isProd ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

/** Matches lib/http.ts MAX_JSON_BYTES; refused here before any buffering. */
const MAX_BODY_BYTES = 64 * 1024;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const declared = Number(req.headers.get('content-length') ?? 0);
  if (pathname.startsWith('/api/') && declared > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: 'Request body is too large.', code: 'payload_too_large' },
      { status: 413 },
    );
  }

  const isProtectedPage =
    pathname !== '/admin/login' &&
    PROTECTED_PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isProtectedApi = PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p));

  if ((isProtectedPage || isProtectedApi) && !hasSessionCookie(req)) {
    if (isProtectedApi) {
      return NextResponse.json(
        { error: 'Authentication required.', code: 'unauthenticated' },
        { status: 401 },
      );
    }
    // Admin pages bounce to the unlisted admin login, everyone else to /login.
    const url = req.nextUrl.clone();
    url.pathname = pathname.startsWith('/admin') ? '/admin/login' : '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // base64 of a UUID: only [A-Za-z0-9+/=], so it cannot break out of the
  // attribute it is rendered into.
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === 'production');

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('content-security-policy', csp);
  // API responses carry account data (cart, orders, profile). Never let a
  // browser or a shared proxy keep a copy.
  if (pathname.startsWith('/api/')) res.headers.set('cache-control', 'no-store');
  return res;
}

export const config = {
  // Skip static assets and Next internals.
  matcher: ['/((?!_next/static|_next/image|favicon.svg|og-image.png|robots.txt).*)'],
};
