import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql, type UserRow } from '@/lib/db';
import { verifyPassword, fakeVerify } from '@/lib/password';
import { createSession } from '@/lib/session';
import {
  chargeAttempt,
  settleAttempt,
  clearAttempts,
  tooManyRequests,
  clientIp,
} from '@/lib/rate-limit';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';

// Argon2 is a native module; this route must run on Node, not Edge.
export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  // No strength rules on login — only on password *creation*. Rejecting a weak
  // password here would leak that it matched the policy of a real account.
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const csrf = await verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();

  const ip = clientIp(request.headers);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.', code: 'bad_request' },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Do not echo which field failed in a way that aids enumeration.
    return NextResponse.json(
      { error: 'Email and password are required.', code: 'bad_request' },
      { status: 400 },
    );
  }
  const { email, password } = parsed.data;

  // Charged before any expensive work, and before the outcome is known, so
  // concurrent guesses count against each other (see chargeAttempt).
  const charge = await chargeAttempt('login', { identifier: email, ip });
  if (charge.limited) return tooManyRequests(charge.retryAfterSeconds);

  const rows = (await sql`
    SELECT id, email, password_hash, role, status, mfa_enabled, session_epoch
      FROM users
     WHERE email = ${email}
     LIMIT 1
  `) as UserRow[];

  const user = rows[0];

  // Same generic failure for "no such account" and "wrong password", and
  // comparable timing via fakeVerify, so login cannot enumerate accounts.
  // A failed attempt is already counted by the charge.
  if (!user) {
    await fakeVerify(password);
    return invalidCredentials();
  }

  const passwordOk = await verifyPassword(user.password_hash, password);
  if (!passwordOk) return invalidCredentials();

  if (user.status === 'SUSPENDED') {
    return NextResponse.json(
      { error: 'This account is not available.', code: 'account_unavailable' },
      { status: 403 },
    );
  }

  await settleAttempt(charge.ticket, true);
  await clearAttempts('login', email);

  // Users with MFA get a half-authenticated session until they pass the TOTP
  // step; requireUser() treats it as unauthenticated for protected resources.
  const mfaSatisfied = !user.mfa_enabled;
  await createSession(user, {
    mfaSatisfied,
    ip,
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({
    ok: true,
    mfaRequired: !mfaSatisfied,
    // Role is returned for UI routing only. It is re-read server-side on every
    // subsequent request and is never trusted from the client.
    user: { email: user.email, role: user.role },
  });
}

function invalidCredentials() {
  return NextResponse.json(
    { error: 'Invalid email or password.', code: 'invalid_credentials' },
    { status: 401 },
  );
}
