/**
 * Deletes rows that only grow: expired sessions, spent reset tokens, old
 * authentication-attempt audit rows and old security events.
 *
 * Runs daily from Vercel Cron (app/api/cron/prune) or by hand with
 * `npm run db:prune`. Retention is deliberately generous; tighten it to match
 * your audit policy.
 */
import { sql } from './pool';

/** Returns the number of rows deleted per table. */
export async function prune(): Promise<Record<string, number>> {
  const steps: [string, () => Promise<unknown[]>][] = [
    ['sessions', () => sql`
      DELETE FROM sessions
       WHERE absolute_expires_at < now() - interval '7 days'
          OR revoked_at < now() - interval '7 days'
      RETURNING 1`],
    ['password_reset_tokens', () => sql`
      DELETE FROM password_reset_tokens WHERE expires_at < now() - interval '7 days' RETURNING 1`],
    ['auth_attempts', () => sql`
      DELETE FROM auth_attempts WHERE created_at < now() - interval '90 days' RETURNING 1`],
    // Only acknowledged events: an open one is an incident nobody has looked at.
    ['security_events', () => sql`
      DELETE FROM security_events
       WHERE acknowledged_at IS NOT NULL AND created_at < now() - interval '180 days'
      RETURNING 1`],
    // The volume baseline reads recent history only.
    ['access_log', () => sql`
      DELETE FROM access_log WHERE created_at < now() - interval '90 days' RETURNING 1`],
    ['mfa_used_totp', () => sql`
      DELETE FROM mfa_used_totp WHERE used_at < now() - interval '1 day' RETURNING 1`],
  ];
  const deleted: Record<string, number> = {};
  for (const [table, run] of steps) deleted[table] = (await run()).length;
  return deleted;
}
