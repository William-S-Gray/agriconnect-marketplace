import 'server-only';
import Redis from 'ioredis';

/**
 * Shared Redis connection, created only when REDIS_URL is configured.
 *
 * Works with any standard Redis endpoint — self-hosted, Upstash's TCP endpoint,
 * Vercel KV, Railway — because they all speak the wire protocol behind a
 * redis:// or rediss:// URL. No provider-specific client is required.
 *
 * Cached on globalThis so Next.js hot reloads reuse one connection instead of
 * opening a new one per module evaluation.
 */
const globalForRedis = globalThis as unknown as { __agriRedis?: Redis | null };

function create(): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  const client = new Redis(url, {
    // Fail fast rather than queueing auth checks behind a dead connection:
    // the caller falls back to Postgres instead of hanging the login request.
    maxRetriesPerRequest: 2,
    connectTimeout: 5_000,
    enableOfflineQueue: false,
    lazyConnect: false,
  });

  // Without a listener, a connection error is an unhandled 'error' event and
  // crashes the process. Rate limiting must degrade, never take the app down.
  client.on('error', () => {
    /* handled by the caller's fallback; deliberately not logged per-event */
  });

  return client;
}

export function getRedis(): Redis | null {
  if (globalForRedis.__agriRedis === undefined) {
    globalForRedis.__agriRedis = create();
  }
  return globalForRedis.__agriRedis;
}

/**
 * The client, but only once it is connected. While it is still connecting —
 * the first requests after a deploy — commands fail at once (offline queue
 * off), which was logged as a Redis outage on every start. Callers fall back
 * to Postgres for those requests without raising the alarm.
 */
export function readyRedis(): Redis | null {
  const client = getRedis();
  return client && client.status === 'ready' ? client : null;
}

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}
