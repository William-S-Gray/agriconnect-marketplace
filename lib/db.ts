/**
 * Application-facing database module.
 *
 * The `server-only` import is the guard: if a client component ever imports
 * this (directly or transitively), the Next build fails rather than shipping
 * database credentials to the browser. The implementation lives in lib/pool.ts
 * so scripts and tests can use it outside the Next runtime.
 */
import 'server-only';

export { sql, query, pool } from './pool';
export type { Role, UserRow } from './pool';
