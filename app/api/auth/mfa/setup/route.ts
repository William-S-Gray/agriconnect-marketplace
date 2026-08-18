import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/rbac';
import { getSession, markMfaSatisfied, invalidateAllSessions } from '@/lib/session';
import { beginEnrolment, confirmEnrolment, disableMfa } from '@/lib/mfa';
import { verifyPassword } from '@/lib/password';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';

export const runtime = 'nodejs';

/**
 * POST — begin enrolment: returns a secret + QR for the authenticator app.
 * PUT  — confirm enrolment with a valid code; returns one-time recovery codes.
 * DELETE — disable MFA, gated behind a fresh password check.
 *
 * The secret is only ever returned to the authenticated owner, and only during
 * enrolment. MFA is not enforced until PUT succeeds, so a user cannot lock
 * themselves out by abandoning setup.
 */

export async function POST() {
  const csrf = verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();

  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const challenge = await beginEnrolment(auth.user.id, auth.user.email);
  return NextResponse.json({
    secret: challenge.secret,
    otpauthUrl: challenge.otpauthUrl,
    qrDataUrl: challenge.qrDataUrl,
  });
}

const confirmSchema = z.object({ code: z.string().trim().min(6).max(8) });

export async function PUT(request: Request) {
  const csrf = verifyOrigin('PUT');
  if (!csrf.ok) return csrfFailure();

  // Cannot use requireUser here: enrolment happens while mfa_enabled is still
  // false, and after PUT the session must be marked satisfied explicitly.
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required.', code: 'unauthenticated' },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'A 6-digit code is required.', code: 'bad_request' },
      { status: 400 },
    );
  }

  const result = await confirmEnrolment(session.id, parsed.data.code);
  if (!result.ok) {
    return NextResponse.json(
      { error: 'Invalid or expired code.', code: 'invalid_code' },
      { status: 401 },
    );
  }

  // The session that just proved possession is treated as MFA-satisfied.
  await markMfaSatisfied(session.sessionId);

  // Recovery codes are shown exactly once; only hashes are stored.
  return NextResponse.json({ ok: true, recoveryCodes: result.recoveryCodes });
}

const disableSchema = z.object({ password: z.string().min(1).max(128) });

export async function DELETE(request: Request) {
  const csrf = verifyOrigin('DELETE');
  if (!csrf.ok) return csrfFailure();

  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = disableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Password confirmation is required.', code: 'bad_request' },
      { status: 400 },
    );
  }

  // Re-authenticate before removing a security control, so a hijacked session
  // cannot strip the second factor on its own.
  const rows = (await sql`
    SELECT password_hash FROM users WHERE id = ${auth.user.id} LIMIT 1
  `) as { password_hash: string }[];

  const hash = rows[0]?.password_hash;
  if (!hash || !(await verifyPassword(hash, parsed.data.password))) {
    return NextResponse.json(
      { error: 'Password is incorrect.', code: 'invalid_credentials' },
      { status: 401 },
    );
  }

  await disableMfa(auth.user.id);
  // Force every session to re-authenticate after a security-posture change.
  await invalidateAllSessions(auth.user.id);

  return NextResponse.json({ ok: true });
}
