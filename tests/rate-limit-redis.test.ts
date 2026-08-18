import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { RedisRateLimitStore, storeKey } from '@/lib/rate-limit-store';

/**
 * Exercises the Redis store against a real server.
 *
 * Skipped when TEST_REDIS_URL is unset, so CI without Redis still passes — but
 * the suite is meaningless in that case, which is why the first test asserts
 * the connection is live rather than silently no-opping.
 */
const url = process.env.TEST_REDIS_URL;
const suite = url ? describe : describe.skip;

const redis = url ? new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false }) : null;
const store = redis ? new RedisRateLimitStore(redis, `test:${randomUUID().slice(0, 8)}:`) : null;

const KEY = storeKey('login', 'identifier', 'someone@example.test');

beforeEach(async () => { await store?.clear(KEY); });
afterAll(async () => { await store?.clear(KEY); await redis?.quit(); });

suite('Redis rate limit store', () => {
  it('is actually connected (guards a vacuous run)', async () => {
    expect(await redis!.ping()).toBe('PONG');
  });

  it('starts empty', async () => {
    const stats = await store!.stats(KEY, 900);
    expect(stats.failures).toBe(0);
    expect(stats.lastFailureAt).toBeNull();
  });

  it('counts failures', async () => {
    for (let i = 0; i < 5; i++) await store!.recordFailure(KEY, new Date(), 900);
    expect((await store!.stats(KEY, 900)).failures).toBe(5);
  });

  it('does not collapse attempts made in the same millisecond', async () => {
    const at = new Date();
    for (let i = 0; i < 10; i++) await store!.recordFailure(KEY, at, 900);
    // A naive score-only member would dedupe these into one entry.
    expect((await store!.stats(KEY, 900)).failures).toBe(10);
  });

  it('records the most recent failure time', async () => {
    const older = new Date(Date.now() - 60_000);
    const newer = new Date();
    await store!.recordFailure(KEY, older, 900);
    await store!.recordFailure(KEY, newer, 900);

    const stats = await store!.stats(KEY, 900);
    expect(stats.lastFailureAt!.getTime()).toBeCloseTo(newer.getTime(), -2);
  });

  it('drops entries that fall outside the window', async () => {
    await store!.recordFailure(KEY, new Date(Date.now() - 3600_000), 900); // 1h ago
    await store!.recordFailure(KEY, new Date(), 900);
    // Only the recent one is inside a 15 minute window.
    expect((await store!.stats(KEY, 900)).failures).toBe(1);
  });

  it('clear() forgets everything for that key', async () => {
    for (let i = 0; i < 3; i++) await store!.recordFailure(KEY, new Date(), 900);
    await store!.clear(KEY);
    expect((await store!.stats(KEY, 900)).failures).toBe(0);
  });

  it('keys are isolated from one another', async () => {
    const other = storeKey('login', 'identifier', 'other@example.test');
    await store!.recordFailure(KEY, new Date(), 900);
    expect((await store!.stats(other, 900)).failures).toBe(0);
    await store!.clear(other);
  });

  it('separates identifier and ip namespaces', async () => {
    const byIp = storeKey('login', 'ip', '203.0.113.9');
    await store!.recordFailure(KEY, new Date(), 900);
    expect((await store!.stats(byIp, 900)).failures).toBe(0);
    await store!.clear(byIp);
  });

  it('sets a TTL so abandoned keys expire without a sweeper', async () => {
    await store!.recordFailure(KEY, new Date(), 900);
    const keys = await redis!.keys('test:*');
    const ttls = await Promise.all(keys.map((k) => redis!.ttl(k)));
    // Every key the store writes must carry a positive TTL; a key with -1
    // would linger forever and leak memory.
    expect(ttls.length).toBeGreaterThan(0);
    expect(ttls.every((t) => t > 0)).toBe(true);
  });
});
