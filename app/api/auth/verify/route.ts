import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession } from '@/lib/session';
import { consumeVerificationToken, peekVerificationToken } from '@/lib/email-verification';
import { verifyPassword } from '@/lib/password';
import { chargeAttempt, settleAttempt } from '@/lib/rate-limit';
import { checkRateLimit, recordAttempt, tooManyRequests, clientIp } from '@/lib/rate-limit';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';
import { homeForRole } from '@/lib/page-guard';
import { readJson } from '@/lib/http';

export const runtime = 'nodejs';

const schema = z.object({
  token: z.string().trim().min(20).max(200),
  password: z.string().min(1).max(128),
});

/**
 * Confirms an email address and signs the new account in.
 *
 * POST, from the confirm button on /verify-email, never GET: mail scanners
 * pre-fetch links, and a GET that signs in would also let someone log a
 * victim into an attacker-controlled account just by getting them to open a
 * link.
 *
 * It also requires the password chosen at sign-up. Without that, someone could
 * register using another person's address with a password of their own; the
 * real owner, receiving the link, would confirm it and start using an account
 * the registrant can also sign into.
 */
export async function POST(request: Request) {
  const csrf = await verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();

  const ip = clientIp(request.headers);
  const limit = await checkRateLimit('register', { ip });
  if (limit.limited) return tooManyRequests(limit.retryAfterSeconds);

  const read = await readJson(request);
  if (!read.ok) return read.response;
  const body = read.data;
  const parsed = schema.safeParse(body);
  const pending = parsed.success ? await peekVerificationToken(parsed.data.token) : null;
  if (parsed.success && pending) {
    // Password guesses here are throttled exactly like sign-in.
    const charge = await chargeAttempt('login', { identifier: pending.email, ip });
    if (charge.limited) return tooManyRequests(charge.retryAfterSeconds);
    if (!(await verifyPassword(pending.passwordHash, parsed.data.password))) {
      return NextResponse.json(
        { error: 'That password does not match the one chosen at sign-up.', code: 'wrong_password' },
        { status: 401 },
      );
    }
    await settleAttempt(charge.ticket, true);
  }
  const user = parsed.success && pending ? await consumeVerificationToken(parsed.data.token) : null;

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
