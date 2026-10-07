import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/rbac';
import { hashPassword, validatePassword, verifyPassword } from '@/lib/password';
import { createSession } from '@/lib/session';
import { chargeAttempt, settleAttempt, tooManyRequests, clientIp } from '@/lib/rate-limit';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';
import { readJson } from '@/lib/http';
import { logEvent } from '@/lib/log';

export const runtime = 'nodejs';

const schema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(128),
});

/**
 * Changes the signed-in user's own password.
 *
 * The current password is required, so a hijacked session alone cannot take
 * the account over. Wrong guesses are charged to the account's *login* budget:
 * guessing it here is the same attack as guessing it at sign-in, and must not
 * get a fresh allowance.
 *
 * The write, the epoch bump and the revocation of every session are one
 * statement; this device then gets a fresh session, so the user stays signed
 * in here and is signed out everywhere else.
 */
export async function POST(request: Request) {
  const csrf = await verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();

  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const read = await readJson(request);
  if (!read.ok) return read.response;
  const parsed = schema.safeParse(read.data);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.', code: 'bad_request' }, { status: 400 });
  }
  const { currentPassword, newPassword } = parsed.data;

  const ip = clientIp(request.headers);
  const charge = await chargeAttempt('login', { identifier: user.email, ip });
  if (charge.limited) return tooManyRequests(charge.retryAfterSeconds);

  const [row] = await sql<{ password_hash: string }>`
    SELECT password_hash FROM users WHERE id = ${user.id}`;
  if (!row || !(await verifyPassword(row.password_hash, currentPassword))) {
    // The failure stays charged.
    return NextResponse.json(
      { error: 'Your current password is incorrect.', code: 'wrong_password' },
      { status: 400 },
    );
  }
  await settleAttempt(charge.ticket, true);

  const strength = validatePassword(newPassword, { email: user.email });
  if (!strength.ok) {
    return NextResponse.json(
      { error: 'Password is not strong enough.', code: 'weak_password', details: strength.errors },
      { status: 400 },
    );
  }
  if (newPassword === currentPassword) {
    return NextResponse.json(
      { error: 'Choose a password different from your current one.', code: 'same_password' },
      { status: 400 },
    );
  }

  const [updated] = await sql<{ id: string; session_epoch: number }>`
    WITH u AS (
      UPDATE users
         SET password_hash = ${await hashPassword(newPassword)},
             session_epoch = session_epoch + 1,
             password_changed_at = now(),
             updated_at = now()
       WHERE id = ${user.id}
       RETURNING id, session_epoch
    ), s AS (
      UPDATE sessions SET revoked_at = now()
       WHERE user_id IN (SELECT id FROM u) AND revoked_at IS NULL
    )
    SELECT id, session_epoch FROM u`;
  if (!updated) {
    return NextResponse.json({ error: 'Account not found.', code: 'not_found' }, { status: 404 });
  }

  // This device passed requireUser, so it had already cleared MFA if enrolled.
  await createSession(updated, {
    mfaSatisfied: true,
    ip,
    userAgent: request.headers.get('user-agent'),
  });

  logEvent('info', 'password_changed', { userId: user.id, by: 'self' });
  return NextResponse.json({ ok: true, message: 'Password changed. Other devices have been signed out.' });
}
