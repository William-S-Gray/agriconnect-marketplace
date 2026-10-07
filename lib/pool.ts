/**
 * Postgres pool and query helpers.
 *
 * Deliberately free of `server-only` so that migration/seed scripts (run under
 * tsx) and tests (run under vitest) can import it. Application code should
 * import from lib/db.ts instead, which re-exports this behind a `server-only`
 * guard so a client component importing it fails at build time.
 */
import { Pool } from 'pg';
import { logError } from './log';

export type Role = 'farmer' | 'buyer' | 'admin';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED';
  mfa_enabled: boolean;
  mfa_secret: string | null;
  session_epoch: number;
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Missing required environment variable DATABASE_URL.');
  return url;
}

/**
 * Decides TLS for a connection target.
 *
 * Neon requires TLS, so remote hosts always get it with certificate validation.
 * TLS is only skipped for loopback or an explicit sslmode=disable, which covers
 * a local Postgres container and CI service containers — neither of which
 * terminates TLS. A remote host can never end up unencrypted by omission.
 */
function sslFor(url: URL): { rejectUnauthorized: true; servername?: string } | false {
  if (url.searchParams.get('sslmode') === 'disable') return false;

  const host = url.hostname;
  const isLoopback =
    host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  if (isLoopback) return false;

  return { rejectUnauthorized: true };
}

/**
 * An idle pooled connection that the server drops — Neon suspending an idle
 * compute, a failover, a restart — emits 'error' on the pool. With no
 * listener, Node treats that as an uncaught exception. The pool already
 * discards the dead client and opens a new one on the next query, so the
 * right response is to log it, not to let it escape.
 */
function withErrorHandler(p: Pool): Pool {
  p.on('error', (error) => logError('db_idle_client_error', error));
  return p;
}

function createPool(): Pool {
  const base = {
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    // Client-side ceiling on any one query. Without it a stuck query held its
    // pooled connection — and the request — indefinitely. Client-side rather
    // than statement_timeout, because a startup parameter is not guaranteed to
    // pass through Neon's pooled (PgBouncer) endpoint.
    query_timeout: 15_000,
  };

  /**
   * Escape hatch for restricted networks. Neon publishes several A records per
   * endpoint; some sandboxes can only reach a subset, and Node's resolver does
   * not fall back between them the way curl's Happy Eyeballs does. Setting
   * DB_PINNED_HOST_IP dials that address directly while still presenting the
   * real hostname for SNI and certificate validation, so TLS is not weakened.
   *
   * Leave unset in production: Neon's addresses rotate and normal hosts resolve
   * the endpoint without help.
   */
  const pinnedIp = process.env.DB_PINNED_HOST_IP?.trim();
  if (pinnedIp) {
    const url = new URL(connectionString());
    return new Pool({
      ...base,
      host: pinnedIp,
      port: Number(url.port || 5432),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      ssl: (() => {
        const ssl = sslFor(url);
        // Pinning dials an IP, so SNI must still present the real hostname.
        return ssl ? { ...ssl, servername: url.hostname } : false;
      })(),
    });
  }

  return new Pool({
    ...base,
    connectionString: connectionString(),
    ssl: sslFor(new URL(connectionString())),
  });
}

// One pool per process. Next.js hot-reloads modules in development, so the pool
// is cached on globalThis to avoid leaking a new pool on every reload.
//
// Development ONLY, deliberately. Caching under NODE_ENV=test made test files
// share one pool across a reused vitest worker: the first file's pool.end()
// left every later file querying a closed pool, which showed up as whole test
// files failing at random.
const globalForDb = globalThis as unknown as { __agriPool?: Pool };
export const pool: Pool = globalForDb.__agriPool ?? withErrorHandler(createPool());
if (process.env.NODE_ENV === 'development') globalForDb.__agriPool = pool;

/**
 * Tagged-template query helper. Values become bound parameters, which is the
 * injection boundary — never interpolate into the template string itself.
 *
 *     await sql`SELECT * FROM users WHERE email = ${email}`
 */
/**
 * Postgres cannot store a NUL character in text and rejects the whole query
 * ("invalid byte sequence for encoding UTF8: 0x00"), so a single %00 in any
 * user input — a search box, a URL parameter — became a 500. No legitimate
 * text contains one; it is removed at the one place every value passes
 * through on its way to the database.
 */
function clean(values: unknown[]): unknown[] {
  const strip = (v: unknown): unknown =>
    typeof v === 'string' ? v.replaceAll('\u0000', '') : Array.isArray(v) ? v.map(strip) : v;
  return values.map(strip);
}

export async function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  let text = '';
  strings.forEach((chunk, i) => {
    text += chunk;
    if (i < values.length) text += `$${i + 1}`;
  });
  const result = await pool.query(text, clean(values));
  return result.rows as T[];
}

/** Escape hatch for dynamic statements (migrations). Never pass user input. */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query(text, clean(params));
  return result.rows as T[];
}
