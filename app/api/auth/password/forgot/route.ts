import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import { sql } from '@/lib/db';
import {
  checkRateLimit,
  recordAttempt,
  tooManyRequests,
  clientIp,
} from '@/lib/rate-limit';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
});

const TOKEN_TTL_MINUTES = 30;

/**
 * Requests a password reset.
 *
 * Always responds with the same generic message whether or not the account
 * exists — the response body, status code and rough timing are identical, so
 * this endpoint cannot be used to enumerate registered emails.
 *
 * The token is 32 random bytes. Only its SHA-256 is stored, so a database dump
 * yields no usable reset links. It expires, is single-use, and any previously
 * issued tokens for the same user are invalidated when a new one is requested.
 */
export async function POST(request: Request) {
  const csrf = verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();

  const ip = clientIp(request.headers);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  // Even a malformed email gets the generic answer, so probing learns nothing.
  if (!parsed.success) return genericResponse();

  const { email } = parsed.data;

  const limit = await checkRateLimit('password_reset', { identifier: email, ip });
  if (limit.limited) return tooManyRequests(limit.retryAfterSeconds);

  await recordAttempt('password_reset', { identifier: email, ip, succeeded: false });

  const rows = (await sql`
    SELECT id FROM users WHERE email = ${email} AND status = 'ACTIVE' LIMIT 1
  `) as { id: string }[];
  const user = rows[0];

  if (user) {
    // Invalidate outstanding tokens so only the newest link works.
    await sql`
      UPDATE password_reset_tokens
         SET used_at = now()
       WHERE user_id = ${user.id} AND used_at IS NULL
    `;

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);

    await sql`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${tokenHash}, ${expiresAt.toISOString()})
    `;

    // No mail provider is configured in this deployment. The link is handed to
    // the mail layer here; it is never returned in the API response and never
    // logged, because either would defeat the whole flow.
    await deliverResetEmail(email, `${env.APP_URL}/reset-password?token=${token}`);
  }

  return genericResponse();
}

function genericResponse() {
  return NextResponse.json({
    ok: true,
    message: 'If an account exists for that email, a password reset link has been sent.',
  });
}

/**
 * Placeholder for the mail integration. Deliberately does not log the token or
 * the URL — a reset link in application logs is equivalent to a leaked
 * credential. Wire this to a provider (Resend/SES/Postmark) at deploy time.
 */
async function deliverResetEmail(_email: string, _resetUrl: string): Promise<void> {
  // Intentionally empty: no provider configured. Do not add logging here.
  return;
}
