import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import { sql } from '@/lib/db';
import { hashPassword, validatePassword } from '@/lib/password';
import { invalidateAllSessions, destroySession } from '@/lib/session';
import {
  checkRateLimit,
  recordAttempt,
  tooManyRequests,
  clientIp,
} from '@/lib/rate-limit';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';

export const runtime = 'nodejs';

const schema = z.object({
  token: z.string().trim().min(20).max(200),
  password: z.string().min(1).max(128),
});

/**
 * Consumes a reset token and sets a new password.
 *
 * The token is matched by hash, must be unexpired and unused, and is marked used
 * inside the same statement that claims it — so two concurrent requests cannot
 * both succeed with one token.
 *
 * On success every existing session for that user is invalidated (epoch bump +
 * row revocation), which is the behaviour that makes a reset actually recover a
 * compromised account rather than leaving the attacker logged in.
 */
export async function POST(request: Request) {
  const csrf = verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();

  const ip = clientIp(request.headers);
  const limit = await checkRateLimit('password_reset', { ip });
  if (limit.limited) return tooManyRequests(limit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'This reset link is invalid or has expired.', code: 'invalid_token' },
      { status: 400 },
    );
  }
  const { token, password } = parsed.data;
  const tokenHash = createHash('sha256').update(token).digest('hex');

  // Claim the token atomically: only an unused, unexpired token is returned.
  const claimed = (await sql`
    UPDATE password_reset_tokens
       SET used_at = now()
     WHERE token_hash = ${tokenHash}
       AND used_at IS NULL
       AND expires_at > now()
     RETURNING user_id
  `) as { user_id: string }[];

  const userId = claimed[0]?.user_id;
  if (!userId) {
    await recordAttempt('password_reset', { ip, succeeded: false });
    // One message for wrong/expired/already-used, so probing learns nothing.
    return NextResponse.json(
      { error: 'This reset link is invalid or has expired.', code: 'invalid_token' },
      { status: 400 },
    );
  }

  const userRows = (await sql`
    SELECT email FROM users WHERE id = ${userId} LIMIT 1
  `) as { email: string }[];
  const email = userRows[0]?.email;

  const strength = validatePassword(password, { email });
  if (!strength.ok) {
    // The token was already consumed above; a weak password means the user must
    // request a new link. Erring toward single-use is the safer tradeoff.
    return NextResponse.json(
      {
        error: 'Password is not strong enough. Please request a new reset link.',
        code: 'weak_password',
        details: strength.errors,
      },
      { status: 400 },
    );
  }

  await sql`
    UPDATE users
       SET password_hash = ${await hashPassword(password)}, updated_at = now()
     WHERE id = ${userId}
  `;

  // Bumps session_epoch and revokes every session row for this user.
  await invalidateAllSessions(userId);
  // Also clear the cookie on the device performing the reset.
  await destroySession();

  await recordAttempt('password_reset', { identifier: email, ip, succeeded: true });

  return NextResponse.json({
    ok: true,
    message: 'Password updated. Please sign in with your new password.',
  });
}
