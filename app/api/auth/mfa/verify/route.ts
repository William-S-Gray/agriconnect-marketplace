import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, markMfaSatisfied } from '@/lib/session';
import { verifyUserTotp, consumeRecoveryCode } from '@/lib/mfa';
import {
  chargeAttempt,
  settleAttempt,
  clearAttempts,
  tooManyRequests,
  clientIp,
} from '@/lib/rate-limit';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';

export const runtime = 'nodejs';

const schema = z.object({
  code: z.string().trim().min(6).max(16),
  /** Set when redeeming a recovery code instead of a TOTP code. */
  recovery: z.boolean().optional(),
});

/**
 * Completes the MFA challenge for a half-authenticated session.
 *
 * Requires an existing session cookie, so this cannot be used to brute-force
 * codes without first passing the password step. Attempts are rate limited per
 * account and per IP, and a TOTP code cannot be replayed within its time step.
 */
export async function POST(request: Request) {
  const csrf = await verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required.', code: 'unauthenticated' },
      { status: 401 },
    );
  }
  if (!session.mfaEnabled) {
    return NextResponse.json(
      { error: 'Two-factor authentication is not enabled.', code: 'mfa_not_enabled' },
      { status: 400 },
    );
  }
  if (session.mfaSatisfied) return NextResponse.json({ ok: true });

  const ip = clientIp(request.headers);
  // Charge-first: six digits is a small space, so a parallel burst of guesses
  // must count against itself (see chargeAttempt).
  const charge = await chargeAttempt('mfa', { identifier: session.email, ip });
  if (charge.limited) return tooManyRequests(charge.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return invalidCode(); // already charged

  const { code, recovery } = parsed.data;
  const ok = recovery
    ? await consumeRecoveryCode(session.id, code)
    : await verifyUserTotp(session.id, code);

  if (!ok) return invalidCode(); // already charged

  await settleAttempt(charge.ticket, true);
  await clearAttempts('mfa', session.email);
  await markMfaSatisfied(session.sessionId);

  return NextResponse.json({ ok: true });
}

function invalidCode() {
  // One message for wrong/expired/reused, so probing cannot distinguish them.
  return NextResponse.json(
    { error: 'Invalid or expired code.', code: 'invalid_code' },
    { status: 401 },
  );
}
