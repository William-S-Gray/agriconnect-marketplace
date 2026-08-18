// Pin the store: other test files set REDIS_URL, and vitest can reuse a worker
// process between files, so an inherited value would silently switch this file
// to the Redis path and make its assertions about Postgres meaningless.
process.env.REDIS_URL = '';

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, pool } from '@/lib/pool';
import {
  checkRateLimit,
  recordAttempt,
  clearAttempts,
  tooManyRequests,
} from '@/lib/rate-limit';

/**
 * Server-side rate limiting, exercised against the shared Postgres store.
 *
 * The policy is progressive delay rather than hard lockout, so these tests also
 * assert the property that matters for availability: an account never becomes
 * permanently unusable, because the delay is capped and always elapses.
 */

const suffix = randomUUID().slice(0, 8);
const email = `ratelimit-${suffix}@example.test`;
const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;

async function fail(times: number, identifier = email) {
  for (let i = 0; i < times; i++) {
    await recordAttempt('login', { identifier, ip: null, succeeded: false });
  }
}

beforeEach(async () => {
  await sql`DELETE FROM auth_attempts WHERE identifier LIKE ${`%${suffix}%`}`;
  await sql`DELETE FROM auth_attempts WHERE ip = ${ip}`;
});

afterAll(async () => {
  await sql`DELETE FROM auth_attempts WHERE identifier LIKE ${`%${suffix}%`}`;
  await sql`DELETE FROM auth_attempts WHERE ip = ${ip}`;
  await pool.end();
});

describe('login throttling', () => {
  it('permits attempts below the allowance', async () => {
    await fail(4);
    const result = await checkRateLimit('login', { identifier: email });
    expect(result.limited).toBe(false);
  });

  it('throttles once the allowance is exceeded', async () => {
    await fail(6);
    const result = await checkRateLimit('login', { identifier: email });
    expect(result.limited).toBe(true);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('increases the delay as failures accumulate', async () => {
    await fail(6);
    const first = await checkRateLimit('login', { identifier: email });
    await fail(3);
    const later = await checkRateLimit('login', { identifier: email });
    expect(later.retryAfterSeconds).toBeGreaterThan(first.retryAfterSeconds);
  });

  it('caps the delay so an account is never locked out permanently', async () => {
    await fail(40);
    const result = await checkRateLimit('login', { identifier: email });
    // The login identifier policy caps at 900s.
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(900);
  });

  it('a successful login clears the accumulated failures', async () => {
    await fail(8);
    expect((await checkRateLimit('login', { identifier: email })).limited).toBe(true);

    await clearAttempts('login', email);
    expect((await checkRateLimit('login', { identifier: email })).limited).toBe(false);
  });

  it('successful attempts do not count toward throttling', async () => {
    for (let i = 0; i < 20; i++) {
      await recordAttempt('login', { identifier: email, succeeded: true });
    }
    expect((await checkRateLimit('login', { identifier: email })).limited).toBe(false);
  });

  it('throttles one account without affecting another', async () => {
    const other = `ratelimit-other-${suffix}@example.test`;
    await fail(8);
    expect((await checkRateLimit('login', { identifier: email })).limited).toBe(true);
    expect((await checkRateLimit('login', { identifier: other })).limited).toBe(false);
  });
});

describe('IP throttling', () => {
  it('throttles a single IP sweeping many accounts', async () => {
    for (let i = 0; i < 35; i++) {
      await recordAttempt('login', {
        identifier: `sweep-${i}-${suffix}@example.test`,
        ip,
        succeeded: false,
      });
    }
    const result = await checkRateLimit('login', { ip });
    expect(result.limited).toBe(true);
  });

  it('has a looser allowance than the per-account limit', async () => {
    for (let i = 0; i < 10; i++) {
      await recordAttempt('login', { identifier: null, ip, succeeded: false });
    }
    // 10 failures would already throttle an account; an IP absorbs more so a
    // shared network is not locked out.
    expect((await checkRateLimit('login', { ip })).limited).toBe(false);
  });
});

describe('OTP and password reset limits', () => {
  it('rate limits MFA verification', async () => {
    for (let i = 0; i < 7; i++) {
      await recordAttempt('mfa', { identifier: email, succeeded: false });
    }
    expect((await checkRateLimit('mfa', { identifier: email })).limited).toBe(true);
  });

  it('rate limits password reset requests more aggressively', async () => {
    for (let i = 0; i < 4; i++) {
      await recordAttempt('password_reset', { identifier: email, succeeded: false });
    }
    expect((await checkRateLimit('password_reset', { identifier: email })).limited).toBe(true);
  });

  it('limits are independent per kind', async () => {
    for (let i = 0; i < 8; i++) {
      await recordAttempt('login', { identifier: email, succeeded: false });
    }
    expect((await checkRateLimit('login', { identifier: email })).limited).toBe(true);
    expect((await checkRateLimit('mfa', { identifier: email })).limited).toBe(false);
  });
});

describe('429 response shape', () => {
  it('returns Retry-After', async () => {
    const res = tooManyRequests(42);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('42');
    const body = await res.json();
    expect(body.code).toBe('rate_limited');
  });

  it('never emits Retry-After below 1 second', () => {
    expect(tooManyRequests(0).headers.get('retry-after')).toBe('1');
  });
});
