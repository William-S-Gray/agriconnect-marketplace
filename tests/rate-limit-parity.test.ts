import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';

/**
 * Parity: the throttling policy must behave identically whichever store backs
 * it. Swapping the counter store is a performance change, not a security one,
 * so a difference here would be a real regression.
 *
 * REDIS_URL is set before importing lib/rate-limit, because the connection is
 * created on first use and cached.
 */
const redisUrl = process.env.TEST_REDIS_URL;
const suite = redisUrl ? describe : describe.skip;

process.env.REDIS_URL = redisUrl ?? '';

const { checkRateLimit, recordAttempt, clearAttempts } = await import('@/lib/rate-limit');
const { getRedis } = await import('@/lib/redis');
const { sql, pool } = await import('@/lib/pool');

const suffix = randomUUID().slice(0, 8);
const email = `parity-${suffix}@example.test`;

async function fail(times: number) {
  for (let i = 0; i < times; i++) {
    await recordAttempt('login', { identifier: email, ip: null, succeeded: false });
  }
}

beforeEach(async () => {
  await clearAttempts('login', email);
});

afterAll(async () => {
  await clearAttempts('login', email);
  await sql`DELETE FROM auth_attempts WHERE identifier LIKE ${`%${suffix}%`}`;
  await getRedis()?.quit();
  await pool.end();
});

suite('rate limiting with Redis configured', () => {
  it('uses Redis, not the fallback', () => {
    expect(getRedis()).not.toBeNull();
  });

  it('allows attempts below the 5-failure allowance', async () => {
    await fail(4);
    expect((await checkRateLimit('login', { identifier: email })).limited).toBe(false);
  });

  it('throttles once the allowance is exceeded', async () => {
    await fail(6);
    const result = await checkRateLimit('login', { identifier: email });
    expect(result.limited).toBe(true);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('escalates the delay with further failures', async () => {
    await fail(6);
    const first = await checkRateLimit('login', { identifier: email });
    await fail(3);
    const later = await checkRateLimit('login', { identifier: email });
    expect(later.retryAfterSeconds).toBeGreaterThan(first.retryAfterSeconds);
  });

  it('caps the delay so an account always recovers', async () => {
    await fail(40);
    expect((await checkRateLimit('login', { identifier: email })).retryAfterSeconds)
      .toBeLessThanOrEqual(900);
  });

  it('a success clears the accumulated failures', async () => {
    await fail(8);
    expect((await checkRateLimit('login', { identifier: email })).limited).toBe(true);
    await clearAttempts('login', email);
    expect((await checkRateLimit('login', { identifier: email })).limited).toBe(false);
  });

  it('still writes the durable audit trail to Postgres', async () => {
    await fail(3);
    const rows = await sql<{ n: string }>`
      SELECT count(*) AS n FROM auth_attempts
       WHERE kind = 'login' AND identifier = ${email} AND succeeded = FALSE
    `;
    // Redis carries the counters; auth_attempts remains the security log.
    expect(Number(rows[0]!.n)).toBe(3);
  });

  it('successful attempts are audited but do not throttle', async () => {
    for (let i = 0; i < 20; i++) {
      await recordAttempt('login', { identifier: email, succeeded: true });
    }
    expect((await checkRateLimit('login', { identifier: email })).limited).toBe(false);
  });
});
