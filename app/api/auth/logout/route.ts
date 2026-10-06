import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/session';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';

export const runtime = 'nodejs';

/**
 * Logout revokes the session row server-side, then clears the cookie. Deleting
 * the cookie alone would leave a valid session behind that a captured token
 * could keep using.
 */
export async function POST() {
  const csrf = await verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();

  await destroySession();
  return NextResponse.json({ ok: true });
}
