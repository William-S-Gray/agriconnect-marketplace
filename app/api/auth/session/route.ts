import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Returns the current user for UI purposes. This is how the frontend answers
 * "am I logged in, and who am I" without holding any token.
 *
 * It returns identity and display data only — never the password hash, MFA
 * secret, or session token. The role is included so the UI can decide what to
 * render, which is explicitly a UX decision: every actual permission is
 * re-checked server-side.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  // Half-authenticated sessions (MFA pending) are reported as such so the UI
  // can show the challenge instead of a dashboard.
  if (session.mfaEnabled && !session.mfaSatisfied) {
    return NextResponse.json({
      authenticated: false,
      mfaRequired: true,
      email: session.email,
    });
  }

  let profile: Record<string, unknown> | null = null;
  if (session.role === 'farmer') {
    const rows = (await sql`
      SELECT id, name, farm_name, phone, province, district, status,
             rating, total_reviews, total_sales, ecocash_number, profile_photo
        FROM farmers WHERE user_id = ${session.id} LIMIT 1
    `) as Record<string, unknown>[];
    profile = rows[0] ?? null;
  } else if (session.role === 'buyer') {
    const rows = (await sql`
      SELECT id, name, phone, buyer_type, city, address, ecocash_number
        FROM buyers WHERE user_id = ${session.id} LIMIT 1
    `) as Record<string, unknown>[];
    profile = rows[0] ?? null;
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      email: session.email,
      role: session.role,
      mfaEnabled: session.mfaEnabled,
    },
    profile,
  });
}
