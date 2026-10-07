import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { hashPassword, validatePassword } from '@/lib/password';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';
import { readJson } from '@/lib/http';
import { logEvent } from '@/lib/log';

export const runtime = 'nodejs';

const schema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(1).max(128),
});

/**
 * An admin sets a new password for another account — the recovery path while
 * no email provider is configured. The user is signed out everywhere, so a
 * reset also evicts whoever may have taken the account over.
 *
 * An admin's own password goes through /api/me/password, which demands the
 * current one; otherwise a stolen admin session could change it here unasked.
 */
export async function POST(request: Request) {
  const csrf = await verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const read = await readJson(request);
  if (!read.ok) return read.response;
  const parsed = schema.safeParse(read.data);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.', code: 'bad_request' }, { status: 400 });
  }
  const { userId, password } = parsed.data;

  if (userId === auth.user.id) {
    return NextResponse.json(
      { error: 'Change your own password under Settings → Security.', code: 'self_reset' },
      { status: 400 },
    );
  }

  const [target] = await sql<{ email: string }>`SELECT email FROM users WHERE id = ${userId}`;
  if (!target) {
    return NextResponse.json({ error: 'No matching account.', code: 'not_found' }, { status: 404 });
  }
  const strength = validatePassword(password, { email: target.email });
  if (!strength.ok) {
    return NextResponse.json(
      { error: 'Password is not strong enough.', code: 'weak_password', details: strength.errors },
      { status: 400 },
    );
  }

  const changed = await sql`
    WITH u AS (
      UPDATE users
         SET password_hash = ${await hashPassword(password)},
             session_epoch = session_epoch + 1,
             password_changed_at = now(),
             updated_at = now()
       WHERE id = ${userId}
       RETURNING id
    ), s AS (
      UPDATE sessions SET revoked_at = now()
       WHERE user_id IN (SELECT id FROM u) AND revoked_at IS NULL
    )
    SELECT id FROM u`;
  if (changed.length === 0) {
    return NextResponse.json({ error: 'No matching account.', code: 'not_found' }, { status: 404 });
  }

  // Ids only, as with the other admin actions.
  logEvent('info', 'admin.user_action', { adminId: auth.user.id, userId, action: 'set_password' });
  return NextResponse.json({ ok: true });
}
