/**
 * Storage backend for authentication rate limiting.
 *
 * Two implementations behind one interface:
 *
 *   Redis (preferred)   — a sorted set of failure timestamps per key. Counting
 *                         and trimming are O(log n) server-side, and the key
 *                         expires on its own, so nothing has to be swept.
 *   Postgres (fallback) — the original auth_attempts table. Correct across
 *                         instances, but every check costs a query against the
 *                         primary, which is the wrong place for write-heavy
 *                         throwaway counters.
 *
 * Redis is used whenever REDIS_URL is set; otherwise the Postgres store is used
 * unchanged. That matters for correctness, not just convenience: an environment
 * without Redis must still rate limit, and must not silently stop limiting.
 *
 * Deliberately NOT an in-memory fallback. A per-process counter would appear to
 * work in development and then fail open across multiple instances in
 * production, which is the failure mode most likely to go unnoticed.
 */
import type { Redis } from 'ioredis';

export interface FailureStats {
  failures: number;
  lastFailureAt: Date | null;
}

export interface RateLimitStore {
  readonly name: 'redis' | 'postgres';
  /** Records one failed attempt against a key. */
  recordFailure(key: string, at: Date, windowSeconds: number): Promise<void>;
  /** Failure count and most recent failure inside the window. */
  stats(key: string, windowSeconds: number): Promise<FailureStats>;
  /** Forgets a key's history, e.g. after a successful login. */
  clear(key: string): Promise<void>;
}

// ─── Redis ────────────────────────────────────────────────────────────────────

/**
 * Sorted set per key: member = a unique attempt id, score = epoch millis.
 *
 * Old entries are trimmed by score on every write and read, so the window
 * slides without a background job, and the key carries a TTL slightly longer
 * than the window so an abandoned key disappears on its own.
 */
export class RedisRateLimitStore implements RateLimitStore {
  readonly name = 'redis' as const;

  constructor(private readonly redis: Redis, private readonly prefix = 'rl:') {}

  private k(key: string): string {
    return `${this.prefix}${key}`;
  }

  async recordFailure(key: string, at: Date, windowSeconds: number): Promise<void> {
    const redisKey = this.k(key);
    const now = at.getTime();
    const cutoff = now - windowSeconds * 1000;

    await this.redis
      .multi()
      .zremrangebyscore(redisKey, 0, cutoff)
      // The member must be unique or repeated attempts in the same millisecond
      // would collapse into one entry and under-count the failures.
      .zadd(redisKey, now, `${now}-${Math.random().toString(36).slice(2, 10)}`)
      .expire(redisKey, windowSeconds + 60)
      .exec();
  }

  async stats(key: string, windowSeconds: number): Promise<FailureStats> {
    const redisKey = this.k(key);
    const cutoff = Date.now() - windowSeconds * 1000;

    const result = await this.redis
      .multi()
      .zremrangebyscore(redisKey, 0, cutoff)
      .zcard(redisKey)
      // Highest score first, so element 0 is the most recent failure.
      .zrevrange(redisKey, 0, 0, 'WITHSCORES')
      .exec();

    // exec() returns [error, value] pairs, or null if the transaction aborted.
    const failures = Number(result?.[1]?.[1] ?? 0);
    const newest = result?.[2]?.[1] as string[] | undefined;
    const lastScore = newest && newest.length >= 2 ? Number(newest[1]) : NaN;

    return {
      failures: Number.isFinite(failures) ? failures : 0,
      lastFailureAt: Number.isFinite(lastScore) ? new Date(lastScore) : null,
    };
  }

  async clear(key: string): Promise<void> {
    await this.redis.del(this.k(key));
  }
}

// ─── Postgres ─────────────────────────────────────────────────────────────────

/**
 * The original store, kept as the fallback so an environment without Redis
 * still rate limits rather than failing open.
 *
 * The key is decomposed back into (kind, column, value) because auth_attempts
 * is also the audit trail for authentication attempts, and keeping it queryable
 * by column is more useful than storing an opaque key string.
 */
export class PostgresRateLimitStore implements RateLimitStore {
  readonly name = 'postgres' as const;

  constructor(
    private readonly sql: <T = Record<string, unknown>>(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => Promise<T[]>,
  ) {}

  private parse(key: string): { kind: string; column: 'identifier' | 'ip'; value: string } {
    // key shape: "<kind>:<column>:<value>"; value may itself contain colons.
    const [kind = '', column = 'identifier', ...rest] = key.split(':');
    return {
      kind,
      column: column === 'ip' ? 'ip' : 'identifier',
      value: rest.join(':'),
    };
  }

  async recordFailure(key: string): Promise<void> {
    const { kind, column, value } = this.parse(key);
    if (column === 'ip') {
      await this.sql`
        INSERT INTO auth_attempts (kind, ip, succeeded)
        VALUES (${kind}::auth_attempt_kind, ${value}, FALSE)
      `;
    } else {
      await this.sql`
        INSERT INTO auth_attempts (kind, identifier, succeeded)
        VALUES (${kind}::auth_attempt_kind, ${value}, FALSE)
      `;
    }
  }

  async stats(key: string, windowSeconds: number): Promise<FailureStats> {
    const { kind, column, value } = this.parse(key);

    const rows =
      column === 'identifier'
        ? await this.sql<{ failures: number; last_failure_at: string | null }>`
            SELECT count(*)::int AS failures, max(created_at) AS last_failure_at
              FROM auth_attempts
             WHERE kind = ${kind}::auth_attempt_kind
               AND identifier = ${value}
               AND succeeded = FALSE
               AND created_at > now() - make_interval(secs => ${windowSeconds})
          `
        : await this.sql<{ failures: number; last_failure_at: string | null }>`
            SELECT count(*)::int AS failures, max(created_at) AS last_failure_at
              FROM auth_attempts
             WHERE kind = ${kind}::auth_attempt_kind
               AND ip = ${value}
               AND succeeded = FALSE
               AND created_at > now() - make_interval(secs => ${windowSeconds})
          `;

    const row = rows[0];
    return {
      failures: row?.failures ?? 0,
      lastFailureAt: row?.last_failure_at ? new Date(row.last_failure_at) : null,
    };
  }

  async clear(key: string): Promise<void> {
    const { kind, column, value } = this.parse(key);
    if (column === 'ip') {
      await this.sql`
        DELETE FROM auth_attempts WHERE kind = ${kind}::auth_attempt_kind AND ip = ${value}
      `;
    } else {
      await this.sql`
        DELETE FROM auth_attempts WHERE kind = ${kind}::auth_attempt_kind AND identifier = ${value}
      `;
    }
  }
}

/** Builds the storage key. Identifiers are lowercased by the caller. */
export function storeKey(kind: string, column: 'identifier' | 'ip', value: string): string {
  return `${kind}:${column}:${value}`;
}
