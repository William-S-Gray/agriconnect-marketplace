import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireAdmin } from '@/lib/rbac';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';
import { readJson } from '@/lib/http';
import { logEvent } from '@/lib/log';

export const runtime = 'nodejs';

/**
 * Acknowledging a security event.
 *
 * Admin-only, and deliberately the only mutation offered: events cannot be
 * edited or deleted through the API. An audit trail that the application can
 * rewrite is not an audit trail, and the account most likely to be compromised
 * here is an admin's.
 */

const schema = z.object({ eventId: z.string().uuid() });

export async function PATCH(request: Request) {
  const csrf = await verifyOrigin('PATCH');
  if (!csrf.ok) return csrfFailure();

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const read = await readJson(request);
  if (!read.ok) return read.response;
  const body = read.data;

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // Records who acknowledged it, and leaves an already-acknowledged event
  // untouched so the original reviewer is not overwritten.
  const rows = await sql<{ id: string }>`
    UPDATE security_events
       SET acknowledged_at = now(), acknowledged_by = ${auth.user.id}
     WHERE id = ${parsed.data.eventId} AND acknowledged_at IS NULL
     RETURNING id
  `;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'That event does not exist or was already acknowledged.' },
      { status: 404 },
    );
  }

  logEvent('info', 'admin.security_event_acknowledged', { adminId: auth.user.id, eventId: parsed.data.eventId });
  return NextResponse.json({ ok: true });
}
