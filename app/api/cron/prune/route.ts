import { NextResponse } from 'next/server';
import { cronAuthorized } from '@/lib/cron';
import { prune } from '@/lib/prune';
import { logError, logEvent } from '@/lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Daily prune, scheduled in vercel.json. */
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  try {
    const deleted = await prune();
    logEvent('info', 'prune_completed', { deleted });
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    logError('prune_failed', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
