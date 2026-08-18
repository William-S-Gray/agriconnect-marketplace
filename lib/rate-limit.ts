import 'server-only';
import { sql } from './db';

/**
 * Server-side rate limiting for authentication endpoints.
 *
 * Store choice: this deployment has no Redis, so the shared store is Postgres
 * (the auth_attempts table). That is correct across multiple server instances,
 * which an in-memory limiter would not be — the tradeoff is one extra round
 * trip per attempt. Documented limitation: at very high volume a Redis or
 * Upstash counter would be cheaper; swap `countRecent`/`record` and nothing
 * else changes.
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

/** Records an attempt. Only failures drive throttling; successes reset it. */
export async function recordAttempt(
  kind: AttemptKind,
  opts: { identifier?: string | null; ip?: string | null; succeeded: boolean },
): Promise<void> {
  const identifier = opts.identifier?.toLowerCase().trim() || null;
  await sql`
    INSERT INTO auth_attempts (kind, identifier, ip, succeeded)
    VALUES (${kind}, ${identifier}, ${opts.ip ?? null}, ${opts.succeeded})
  `;
}

/**
 * Clears failure history for an identifier after a genuine success, so a user
 * who eventually remembers their password is not still throttled.
 */
export async function clearAttempts(
  kind: AttemptKind,
  identifier: string,
): Promise<void> {
  await sql`
    DELETE FROM auth_attempts
     WHERE kind = ${kind} AND identifier = ${identifier.toLowerCase().trim()}
  `;
}

interface FailureStats {
  failures: number;
  lastFailureAt: Date | null;
}

async function failureStats(
  kind: AttemptKind,
  column: 'identifier' | 'ip',
  value: string,
  windowSeconds: number,
): Promise<FailureStats> {
  const rows =
    column === 'identifier'
      ? ((await sql`
          SELECT count(*)::int AS failures, max(created_at) AS last_failure_at
            FROM auth_attempts
           WHERE kind = ${kind}
             AND identifier = ${value}
             AND succeeded = FALSE
             AND created_at > now() - make_interval(secs => ${windowSeconds})
        `) as { failures: number; last_failure_at: string | null }[])
      : ((await sql`
          SELECT count(*)::int AS failures, max(created_at) AS last_failure_at
            FROM auth_attempts
           WHERE kind = ${kind}
             AND ip = ${value}
             AND succeeded = FALSE
             AND created_at > now() - make_interval(secs => ${windowSeconds})
        `) as { failures: number; last_failure_at: string | null }[]);

  const row = rows[0];
  return {
    failures: row?.failures ?? 0,
    lastFailureAt: row?.last_failure_at ? new Date(row.last_failure_at) : null,
  };
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
