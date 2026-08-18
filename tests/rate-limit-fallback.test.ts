import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';

/**
 * The safety-critical case: Redis configured but unreachable.
 *
 * Rate limiting must degrade to Postgres, never fail open. A limiter that stops
 * limiting when its counter store is down is worse than no limiter, because
 * nobody notices until it is exploited.
 */
process.env.REDIS_URL = 'redis://127.0.0.1:6399'; // nothing listens here

const { checkRateLimit, recordAttempt, clearAttempts } = await import('@/lib/rate-limit');
const { sql, pool } = await import('@/lib/pool');
const { getRedis } = await import('@/lib/redis');

const suffix = randomUUID().slice(0, 8);
const email = `fallback-${suffix}@example.test`;

afterAll(async () => {
  await sql`DELETE FROM auth_attempts WHERE identifier LIKE ${`%${suffix}%`}`;
  getRedis()?.disconnect();
  await pool.end();
});

describe('Redis unreachable', () => {
  it('still records attempts (audit trail is Postgres)', async () => {
    for (let i = 0; i < 7; i++) {
      await recordAttempt('login', { identifier: email, succeeded: false });
    }
    const rows = await sql<{ n: string }>`
      SELECT count(*) AS n FROM auth_attempts WHERE identifier = ${email}
    `;
    expect(Number(rows[0]!.n)).toBe(7);
  });

  it('still throttles — it does NOT fail open', async () => {
    const result = await checkRateLimit('login', { identifier: email });
    expect(result.limited).toBe(true);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('clearing still works through the fallback', async () => {
    await clearAttempts('login', email);
    expect((await checkRateLimit('login', { identifier: email })).limited).toBe(false);
  });
});
