import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Vercel Cron calls scheduled routes with `Authorization: Bearer $CRON_SECRET`.
 * Anything else is refused, and so is every request while CRON_SECRET is
 * unset — a cron route never runs open.
 */
export function cronAuthorized(header: string | null, secret = process.env.CRON_SECRET): boolean {
  if (!secret || !header) return false;
  // Compare digests: constant time, and equal length whatever was sent.
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
