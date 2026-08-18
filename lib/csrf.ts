import 'server-only';
import { headers } from 'next/headers';
import { env } from './env';

/**
 * CSRF protection for state-changing requests.
 *
 * Next.js does not ship a CSRF token mechanism for route handlers, so this adds
 * one — but deliberately the lightweight kind rather than a custom token store,
 * because the session cookie is already SameSite=Lax. Layers, weakest first:
 *
 *   1. SameSite=Lax on the session cookie. Blocks cross-site POST/PUT/DELETE
 *      outright in every current browser; Lax only rides along on top-level
 *      GET navigation.
 *   2. Origin/Referer checking (below). Catches same-site-but-wrong-origin and
 *      any browser that mishandles SameSite.
 *   3. Route handlers only accept JSON bodies. HTML forms cannot send
 *      application/json cross-origin without a preflight, which CORS blocks
 *      since no cross-origin policy is configured.
 *
 * A synchroniser token would add little here and a lot of moving parts; if this
 * app later needs cross-site embedding (SameSite=None), replace this with a
 * double-submit token.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface CsrfResult {
  ok: boolean;
  reason?: string;
}

/**
 * Verifies the request originates from this site. Call at the top of every
 * mutating route handler.
 */
export function verifyOrigin(method: string): CsrfResult {
  if (SAFE_METHODS.has(method.toUpperCase())) return { ok: true };

  const h = headers();
  const origin = h.get('origin');
  const referer = h.get('referer');

  // Same-origin fetch always sends Origin for mutating requests.
  if (origin) {
    return isAllowed(origin)
      ? { ok: true }
      : { ok: false, reason: 'origin_mismatch' };
  }

  // Fall back to Referer when Origin is absent.
  if (referer) {
    try {
      return isAllowed(new URL(referer).origin)
        ? { ok: true }
        : { ok: false, reason: 'referer_mismatch' };
    } catch {
      return { ok: false, reason: 'referer_unparseable' };
    }
  }

  // Neither header: refuse. A legitimate browser fetch always sends one.
  return { ok: false, reason: 'origin_missing' };
}

function isAllowed(origin: string): boolean {
  const allowed = new Set<string>([env.APP_URL]);
  if (!env.isProduction) {
    allowed.add('http://localhost:3000');
    allowed.add('http://127.0.0.1:3000');
  }
  // Also accept the request's own host, so preview deployments work without
  // reconfiguring APP_URL for every generated hostname.
  const host = headers().get('host');
  if (host) {
    allowed.add(`https://${host}`);
    if (!env.isProduction) allowed.add(`http://${host}`);
  }
  return allowed.has(origin);
}

/** 403 response for a failed origin check. */
export function csrfFailure(): Response {
  return new Response(
    JSON.stringify({ error: 'Request blocked.', code: 'csrf' }),
    { status: 403, headers: { 'content-type': 'application/json' } },
  );
}
