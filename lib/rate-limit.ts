import 'server-only';
import { sql } from './db';
import { getRedis } from './redis';
import {
  RedisRateLimitStore,
  PostgresRateLimitStore,
  storeKey,
  type RateLimitStore,
  type FailureStats,
} from './rate-limit-store';

/**
 * Server-side rate limiting for authentication endpoints.
 *
 * Store: Redis when REDIS_URL is set, Postgres otherwise. Both are shared
 * across instances, which an in-memory limiter would not be — a per-process
 * counter looks fine in development and then fails open behind a load balancer.
 *
 * Redis is preferred because these are high-churn, disposable counters: putting
 * them on the primary database means a write and a read on the authentication
 * path for every attempt. If Redis is configured but unreachable, the limiter
 * falls back to Postgres for that call rather than failing open — an outage in
 * the counter store must never disable rate limiting.
 *
 * Policy shape: progressive delay rather than hard account lockout. A permanent
 * lockout keyed on email is itself a denial-of-service vector — anyone could
 * lock any account by failing logins against it. Instead, failures accrue a
 * growing required wait, capped, and always eventually recovering. IP is
 * limited separately and more loosely, so one NAT'd network cannot lock out a
 * whole region.
 */

export type AttemptKind = 'login' | 'mfa' | 'password_reset' | 'register';

interface Policy {
  /** Failures allowed inside the window before throttling begins. */
  freeAttempts: number;
  /** Sliding window for counting failures. */
  windowSeconds: number;
  /** Delay after the first throttled failure, doubling each time. */
  baseDelaySeconds: number;
  /** Ceiling on the delay, so accounts always recover. */
  maxDelaySeconds: number;
}

const IDENTIFIER_POLICY: Record<AttemptKind, Policy> = {
  // Password guessing against one account.
  login:          { freeAttempts: 5,  windowSeconds: 900, baseDelaySeconds: 15, maxDelaySeconds: 900 },
  // TOTP is only 6 digits, so this is deliberately tight.
  mfa:            { freeAttempts: 5,  windowSeconds: 900, baseDelaySeconds: 30, maxDelaySeconds: 900 },
  password_reset: { freeAttempts: 3,  windowSeconds: 3600, baseDelaySeconds: 60, maxDelaySeconds: 3600 },
  register:       { freeAttempts: 5,  windowSeconds: 3600, baseDelaySeconds: 30, maxDelaySeconds: 900 },
};

/** Looser, to absorb shared egress IPs while still stopping broad sweeps. */
const IP_POLICY: Record<AttemptKind, Policy> = {
  login:          { freeAttempts: 30, windowSeconds: 900,  baseDelaySeconds: 5,  maxDelaySeconds: 300 },
  mfa:            { freeAttempts: 30, windowSeconds: 900,  baseDelaySeconds: 5,  maxDelaySeconds: 300 },
  password_reset: { freeAttempts: 15, windowSeconds: 3600, baseDelaySeconds: 15, maxDelaySeconds: 900 },
  register:       { freeAttempts: 15, windowSeconds: 3600, baseDelaySeconds: 15, maxDelaySeconds: 900 },
};

export interface RateLimitResult {
  limited: boolean;
  /** Seconds the caller must wait; feeds the Retry-After header. */
  retryAfterSeconds: number;
}

const ALLOWED: RateLimitResult = { limited: false, retryAfterSeconds: 0 };

/**
 * Records an attempt. Only failures drive throttling; successes reset it.
 *
 * auth_attempts is written either way, because it is the durable audit trail of
 * authentication attempts and should survive independently of whatever is
 * counting. When Redis is the counter store the failure is additionally pushed
 * there; when it is not, the audit row IS the counter, so writing to both would
 * double-count.
 */
export async function recordAttempt(
  kind: AttemptKind,
  opts: { identifier?: string | null; ip?: string | null; succeeded: boolean },
): Promise<void> {
  const identifier = opts.identifier?.toLowerCase().trim() || null;

  await sql`
    INSERT INTO auth_attempts (kind, identifier, ip, succeeded)
    VALUES (${kind}, ${identifier}, ${opts.ip ?? null}, ${opts.succeeded})
  `;

  if (opts.succeeded) return;

  const redis = getRedis();
  if (!redis) return; // Postgres store counts the audit row written above.

  const store = new RedisRateLimitStore(redis);
  const now = new Date();
  try {
    if (identifier) {
      await store.recordFailure(
        storeKey(kind, 'identifier', identifier), now, IDENTIFIER_POLICY[kind].windowSeconds,
      );
    }
    if (opts.ip) {
      await store.recordFailure(
        storeKey(kind, 'ip', opts.ip), now, IP_POLICY[kind].windowSeconds,
      );
    }
  } catch {
    // The audit row is already committed, so a Redis outage degrades to the
    // Postgres store counting that row — the attempt is never uncounted.
  }
}

/**
 * Clears failure history for an identifier after a genuine success, so a user
 * who eventually remembers their password is not still throttled.
 */
export async function clearAttempts(
  kind: AttemptKind,
  identifier: string,
): Promise<void> {
  const value = identifier.toLowerCase().trim();

  // Clear both stores: whichever is active must forget the history, and a
  // later switch between them must not resurrect stale failures.
  await sql`
    DELETE FROM auth_attempts
     WHERE kind = ${kind} AND identifier = ${value}
  `;

  const redis = getRedis();
  if (!redis) return;
  try {
    await new RedisRateLimitStore(redis).clear(storeKey(kind, 'identifier', value));
  } catch {
    // Postgres history is already cleared; a stale Redis key expires on its own.
  }
}

const postgresStore = new PostgresRateLimitStore(sql);

/**
 * Picks the store per call. Redis when configured and healthy, Postgres
 * otherwise — including when a Redis command throws, so a counter-store outage
 * degrades to the slower store instead of removing the limit.
 */
async function withStore<T>(
  run: (store: RateLimitStore) => Promise<T>,
): Promise<T> {
  const redis = getRedis();
  if (redis) {
    try {
      return await run(new RedisRateLimitStore(redis));
    } catch {
      // Fall through to Postgres. Deliberately silent per call: a flapping
      // Redis would otherwise flood the logs from the login path.
    }
  }
  return run(postgresStore);
}

async function failureStats(
  kind: AttemptKind,
  column: 'identifier' | 'ip',
  value: string,
  windowSeconds: number,
): Promise<FailureStats> {
  return withStore((store) => store.stats(storeKey(kind, column, value), windowSeconds));
}

function evaluate(stats: FailureStats, policy: Policy): RateLimitResult {
  if (stats.failures <= policy.freeAttempts || !stats.lastFailureAt) {
    return ALLOWED;
  }

  // Each failure past the allowance doubles the wait, up to the cap.
  const over = stats.failures - policy.freeAttempts;
  const delay = Math.min(
    policy.baseDelaySeconds * 2 ** (over - 1),
    policy.maxDelaySeconds,
  );

  const elapsed = (Date.now() - stats.lastFailureAt.getTime()) / 1000;
  const remaining = Math.ceil(delay - elapsed);
  return remaining > 0
    ? { limited: true, retryAfterSeconds: remaining }
    : ALLOWED;
}

/**
 * Checks both the account identifier and the IP. Returns the longer wait when
 * both are throttled.
 */
export async function checkRateLimit(
  kind: AttemptKind,
  opts: { identifier?: string | null; ip?: string | null },
): Promise<RateLimitResult> {
  const checks: Promise<RateLimitResult>[] = [];

  const identifier = opts.identifier?.toLowerCase().trim();
  if (identifier) {
    checks.push(
      failureStats(kind, 'identifier', identifier, IDENTIFIER_POLICY[kind].windowSeconds)
        .then((s) => evaluate(s, IDENTIFIER_POLICY[kind])),
    );
  }
  if (opts.ip) {
    checks.push(
      failureStats(kind, 'ip', opts.ip, IP_POLICY[kind].windowSeconds)
        .then((s) => evaluate(s, IP_POLICY[kind])),
    );
  }
  if (checks.length === 0) return ALLOWED;

  const results = await Promise.all(checks);
  return results.reduce(
    (worst, r) =>
      r.limited && r.retryAfterSeconds > worst.retryAfterSeconds ? r : worst,
    ALLOWED,
  );
}

/** Standard 429 with Retry-After, for use by route handlers. */
export function tooManyRequests(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many attempts. Please try again later.',
      code: 'rate_limited',
      retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': String(Math.max(1, retryAfterSeconds)),
      },
    },
  );
}

/** Best-effort client IP from proxy headers. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return headers.get('x-real-ip') ?? null;
}
