import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { logError } from '@/lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness + database readiness for load balancers and uptime checks.
 * Unauthenticated by design, so it reveals nothing beyond up/down.
 */
export async function GET() {
  try {
    await pool.query('SELECT 1');
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError('health_db_unreachable', error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
