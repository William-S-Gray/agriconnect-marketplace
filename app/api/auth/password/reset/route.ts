import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import { sql } from '@/lib/db';
import { hashPassword, validatePassword } from '@/lib/password';
import { destroySession } from '@/lib/session';
import {
  checkRateLimit,
  recordAttempt,
  tooManyRequests,
  clientIp,
} from '@/lib/rate-limit';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';
import { readJson } from '@/lib/http';

export const runtime = 'nodejs';

const schema = z.object({
  token: z.string().trim().min(20).max(200),
  password: z.string().min(1).max(128),
});

/**
 * Consumes a reset token and sets a new password.
 *
 * The token is looked up first WITHOUT being consumed, so a password that fails
 * the strength policy does not burn the link. The claim, the password write,
 * the epoch bump and the session revocation are then one statement: either
 * all of it happens or none of it does, and two concurrent requests cannot
 * both succeed with one token.
 *
 * Revoking every session is what makes a reset actually recover a compromised
 * account; doing it in a separate statement meant a failure in between left the
 * attacker logged in with the password already changed.
 */
export async function POST(request: Request) {
  const csrf = await verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();

  const ip = clientIp(request.headers);
  const limit = await checkRateLimit('password_reset', { ip });
  if (limit.limited) return tooManyRequests(limit.retryAfterSeconds);

  const read = await readJson(request);
  if (!read.ok) return read.response;
  const body = read.data;

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'This reset link is invalid or has expired.', code: 'invalid_token' },
      { status: 400 },
    );
  }
  const { token, password } = parsed.data;
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const pending = (await sql`
    SELECT u.email FROM password_reset_tokens t JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ${tokenHash} AND t.used_at IS NULL AND t.expires_at > now()
     LIMIT 1
  `) as { email: string }[];
  const email = pending[0]?.email;
  if (!email) return invalidToken(ip);

  const strength = validatePassword(password, { email });
  if (!strength.ok) {
    return NextResponse.json(
      { error: 'Password is not strong enough.', code: 'weak_password', details: strength.errors },
      { status: 400 },
    );
  }

  const done = (await sql`
    WITH t AS (
      UPDATE password_reset_tokens SET used_at = now()
       WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > now()
       RETURNING user_id
    ), u AS (
      UPDATE users
         SET password_hash = ${await hashPassword(password)},
             session_epoch = session_epoch + 1,
             -- The reset link was delivered to this address, which proves it.
             email_verified_at = COALESCE(email_verified_at, now()),
             password_changed_at = now(),
             updated_at = now()
       WHERE id IN (SELECT user_id FROM t)
       RETURNING id
    ), s AS (
      UPDATE sessions SET revoked_at = now()
       WHERE user_id IN (SELECT id FROM u) AND revoked_at IS NULL
    )
    SELECT id FROM u
  `) as { id: string }[];
  // Raced by a concurrent reset, or expired between the two statements.
  if (done.length === 0) return invalidToken(ip);

  // Also clear the cookie on the device performing the reset.
  await destroySession();

  await recordAttempt('password_reset', { identifier: email, ip, succeeded: true });

  return NextResponse.json({
    ok: true,
    message: 'Password updated. Please sign in with your new password.',
  });
}

async function invalidToken(ip: string | null) {
  await recordAttempt('password_reset', { ip, succeeded: false });
  // One message for wrong/expired/already-used, so probing learns nothing.
  return NextResponse.json(
    { error: 'This reset link is invalid or has expired.', code: 'invalid_token' },
    { status: 400 },
  );
}
