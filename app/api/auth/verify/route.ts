import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession } from '@/lib/session';
import { consumeVerificationToken } from '@/lib/email-verification';
import { checkRateLimit, recordAttempt, tooManyRequests, clientIp } from '@/lib/rate-limit';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';
import { homeForRole } from '@/lib/page-guard';

export const runtime = 'nodejs';

const schema = z.object({ token: z.string().trim().min(20).max(200) });

/**
 * Confirms an email address and signs the new account in.
 *
 * POST, from the confirm button on /verify-email, never GET: mail scanners
 * pre-fetch links, and a GET that signs in would also let someone log a
 * victim into an attacker-controlled account just by getting them to open a
 * link.
 */
export async function POST(request: Request) {
  const csrf = await verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();

  const ip = clientIp(request.headers);
  const limit = await checkRateLimit('register', { ip });
  if (limit.limited) return tooManyRequests(limit.retryAfterSeconds);

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  const user = parsed.success ? await consumeVerificationToken(parsed.data.token) : null;

  if (!user || user.status === 'SUSPENDED') {
    await recordAttempt('register', { ip, succeeded: false });
    return NextResponse.json(
      { error: 'This link is invalid or has expired. Request a new one from the sign-in page.', code: 'invalid_token' },
      { status: 400 },
    );
  }

  // A brand-new account has no MFA, so the session is fully authenticated.
  await createSession(user, { mfaSatisfied: true, ip, userAgent: request.headers.get('user-agent') });
  return NextResponse.json({ ok: true, next: homeForRole(user.role) });
}
