import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { revokeAllSessionsForUser } from '@/lib/session';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';

export const runtime = 'nodejs';

/**
 * The endpoint from the spec's example: GET /api/admin/users.
 *
 * A normal user calling this directly with curl gets 403 — the check is here in
 * the handler, not in the UI, so there is no frontend to bypass. An
 * unauthenticated caller gets 401.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const users = (await sql`
    SELECT u.id, u.email, u.role, u.status, u.mfa_enabled, u.created_at,
           COALESCE(f.name, b.name) AS name,
           f.farm_name, f.status AS farmer_status, f.province
      FROM users u
      LEFT JOIN farmers f ON f.user_id = u.id
      LEFT JOIN buyers  b ON b.user_id = u.id
     ORDER BY u.created_at DESC
     LIMIT 200
  `) as Record<string, unknown>[];

  // Note the explicit column list: password_hash and mfa_secret are never
  // selected, so they cannot leak through this response.
  return NextResponse.json({ users });
}

const patchSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['suspend', 'reactivate', 'verify_farmer', 'suspend_farmer']),
});

/**
 * Admin-only state changes. Role assignment is deliberately NOT available here:
 * promoting a user to admin is not an in-app operation in this design, so there
 * is no request an attacker can craft that grants it.
 */
export async function PATCH(request: Request) {
  const csrf = verifyOrigin('PATCH');
  if (!csrf.ok) return csrfFailure();

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request.', code: 'bad_request' },
      { status: 400 },
    );
  }
  const { userId, action } = parsed.data;

  // An admin cannot suspend themselves out of the system by accident.
  if (userId === auth.user.id && action === 'suspend') {
    return NextResponse.json(
      { error: 'You cannot suspend your own account.', code: 'self_suspend' },
      { status: 400 },
    );
  }

  switch (action) {
    case 'suspend':
      await sql`UPDATE users SET status = 'SUSPENDED', updated_at = now() WHERE id = ${userId}`;
      // Kick the suspended user out immediately rather than at token expiry.
      await revokeAllSessionsForUser(userId);
      break;
    case 'reactivate':
      await sql`UPDATE users SET status = 'ACTIVE', updated_at = now() WHERE id = ${userId}`;
      break;
    case 'verify_farmer':
      await sql`
        UPDATE farmers SET status = 'VERIFIED', updated_at = now()
         WHERE user_id = ${userId}
      `;
      break;
    case 'suspend_farmer':
      await sql`
        UPDATE farmers SET status = 'SUSPENDED', updated_at = now()
         WHERE user_id = ${userId}
      `;
      break;
  }

  return NextResponse.json({ ok: true });
}
