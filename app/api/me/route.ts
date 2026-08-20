import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireUser, stripPrivilegedFields } from '@/lib/rbac';
import { observePrivilegedFields } from '@/lib/anomaly-monitor';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';

export const runtime = 'nodejs';

/**
 * Self-service profile update.
 *
 * This is the endpoint an attacker would target to escalate, by adding
 * {"role":"admin"} to the body. Two independent defences:
 *
 *   1. The zod schema below has no `role`, `status` or `id` field, so those keys
 *      are dropped before anything reads them.
 *   2. stripPrivilegedFields() runs first and reports what it removed, so an
 *      attempt is visible rather than silently ignored.
 *
 * The update statements name their columns explicitly and target rows by the
 * session's user id — never an id supplied by the client.
 */

const farmerPatch = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  farm_name: z.string().trim().min(2).max(160).optional(),
  phone: z.string().trim().max(20).optional(),
  province: z.string().trim().max(80).optional(),
  district: z.string().trim().max(80).optional(),
  ecocash_number: z.string().trim().max(20).optional(),
});

const buyerPatch = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  city: z.string().trim().max(80).optional(),
  address: z.string().trim().max(240).optional(),
  ecocash_number: z.string().trim().max(20).optional(),
});

export async function PATCH(request: Request) {
  const csrf = verifyOrigin('PATCH');
  if (!csrf.ok) return csrfFailure();

  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // Defence in depth: remove privileged keys before validation and surface the
  // fact that they were present.
  const { clean, stripped } = stripPrivilegedFields(body as Record<string, unknown>);

  // No part of this application's UI ever sends one of these, so an attempt to
  // set one is reported as a privilege escalation attempt rather than silently
  // dropped. Field names only — never the values.
  if (stripped.length > 0) {
    await observePrivilegedFields(auth.user.id, auth.user.sessionId, stripped);
  }

  if (auth.user.role === 'farmer') {
    const parsed = farmerPatch.safeParse(clean);
    if (!parsed.success) return badRequest();
    const p = parsed.data;
    await sql`
      UPDATE farmers
         SET name           = COALESCE(${p.name ?? null}, name),
             farm_name      = COALESCE(${p.farm_name ?? null}, farm_name),
             phone          = COALESCE(${p.phone ?? null}, phone),
             province       = COALESCE(${p.province ?? null}, province),
             district       = COALESCE(${p.district ?? null}, district),
             ecocash_number = COALESCE(${p.ecocash_number ?? null}, ecocash_number),
             updated_at     = now()
       WHERE user_id = ${auth.user.id}
    `;
  } else if (auth.user.role === 'buyer') {
    const parsed = buyerPatch.safeParse(clean);
    if (!parsed.success) return badRequest();
    const p = parsed.data;
    await sql`
      UPDATE buyers
         SET name           = COALESCE(${p.name ?? null}, name),
             phone          = COALESCE(${p.phone ?? null}, phone),
             city           = COALESCE(${p.city ?? null}, city),
             address        = COALESCE(${p.address ?? null}, address),
             ecocash_number = COALESCE(${p.ecocash_number ?? null}, ecocash_number),
             updated_at     = now()
       WHERE user_id = ${auth.user.id}
    `;
  } else {
    // Admins have no self-service profile row to edit.
    return NextResponse.json(
      { error: 'No editable profile for this account.', code: 'no_profile' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    // Reported back so a client bug is visible; the role is unchanged either way.
    ignoredFields: stripped,
    role: auth.user.role,
  });
}

function badRequest() {
  return NextResponse.json(
    { error: 'Invalid profile data.', code: 'validation_failed' },
    { status: 400 },
  );
}
