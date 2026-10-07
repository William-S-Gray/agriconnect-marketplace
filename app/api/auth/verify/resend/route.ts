import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { env } from '@/lib/env';
import { sendMail, verifyEmailMessage } from '@/lib/mail';
import { issueVerificationToken } from '@/lib/email-verification';
import { checkRateLimit, recordAttempt, tooManyRequests, clientIp } from '@/lib/rate-limit';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';

export const runtime = 'nodejs';

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(255) });

/**
 * Sends a fresh verification link. Same answer whether or not the address
 * exists or is already verified, so it cannot be used to probe accounts; each
 * request counts against the register limits so it cannot flood an inbox.
 */
export async function POST(request: Request) {
  const csrf = await verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return generic();

  const ip = clientIp(request.headers);
  const { email } = parsed.data;
  const limit = await checkRateLimit('register', { identifier: email, ip });
  if (limit.limited) return tooManyRequests(limit.retryAfterSeconds);
  await recordAttempt('register', { identifier: email, ip, succeeded: false });

  const [user] = await sql<{ id: string }>`
    SELECT id FROM users WHERE email = ${email} AND email_verified_at IS NULL AND status = 'ACTIVE'
  `;
  if (user) {
    const token = await issueVerificationToken(user.id);
    await sendMail(verifyEmailMessage(email, `${env.APP_URL}/verify-email?token=${token}`));
  }
  return generic();
}

function generic() {
  return NextResponse.json({
    ok: true,
    message: 'If that address has an account waiting to be confirmed, a new link is on its way.',
  });
}
