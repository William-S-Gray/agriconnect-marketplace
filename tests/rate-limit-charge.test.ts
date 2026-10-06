// Pinned to the Postgres store; the Redis store is covered in rate-limit-parity.
process.env.REDIS_URL = '';

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, pool } from '@/lib/pool';
import { chargeAttempt, settleAttempt, checkRateLimit, clientIp } from '@/lib/rate-limit';

/**
 * F-007: check-then-record let a parallel burst through whole. Charge-first
 * must bound a burst to the free allowance (5) plus the attempt that sees it.
 */

const suffix = randomUUID().slice(0, 8);
const email = `charge-${suffix}@example.test`;

beforeEach(async () => {
  await sql`DELETE FROM auth_attempts WHERE identifier = ${email}`;
});

afterAll(async () => {
  await sql`DELETE FROM auth_attempts WHERE identifier = ${email}`;
  await pool.end();
});

describe('charge-first rate limiting', () => {
  it('bounds a concurrent burst, where check-then-record let all of it through', async () => {
    const burst = await Promise.all(
      Array.from({ length: 30 }, () => chargeAttempt('login', { identifier: email })),
    );
    // Each attempt counts the others still in flight, so a burst can be
    // refused entirely: that is the fail-closed direction, and intended.
    expect(burst.filter((r) => !r.limited).length).toBeLessThanOrEqual(6);
  });

  it('keeps the old sequential semantics: six attempts, then throttled', async () => {
    let passed = 0;
    for (let i = 0; i < 8; i++) {
      if (!(await chargeAttempt('login', { identifier: email })).limited) passed++;
    }
    expect(passed).toBe(6);
  });

  it('refunds throttled attempts, so hammering does not extend the lockout', async () => {
    const burst = await Promise.all(
      Array.from({ length: 30 }, () => chargeAttempt('login', { identifier: email })),
    );
    const passed = burst.filter((r) => !r.limited).length;
    const [row] = await sql<{ n: number }>`
      SELECT count(*)::int AS n FROM auth_attempts WHERE identifier = ${email}`;
    expect(row!.n).toBe(passed);
  });

  it('a settled success stops counting as a failure', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await chargeAttempt('login', { identifier: email });
      if (r.limited) throw new Error('throttled too early');
      await settleAttempt(r.ticket, true);
    }
    expect((await checkRateLimit('login', { identifier: email })).limited).toBe(false);
    const [row] = await sql<{ n: number }>`
      SELECT count(*)::int AS n FROM auth_attempts WHERE identifier = ${email} AND succeeded`;
    expect(row!.n).toBe(5);
  });
});

describe('client IP (F-008)', () => {
  it('takes the proxy-appended rightmost hop, not the client-supplied leftmost', () => {
    const h = new Headers({ 'x-forwarded-for': '6.6.6.6, 198.51.100.7' });
    expect(clientIp(h)).toBe('198.51.100.7');
  });

  it('handles a single hop and a missing header', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '198.51.100.7' }))).toBe('198.51.100.7');
    expect(clientIp(new Headers({ 'x-real-ip': '198.51.100.8' }))).toBe('198.51.100.8');
    expect(clientIp(new Headers())).toBeNull();
  });
});
