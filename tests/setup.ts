/**
 * Loads .env.local so integration tests reach the dev database, and fails fast
 * with a clear message if it is missing rather than producing confusing
 * connection errors deep inside a test.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const envPath = join(process.cwd(), '.env.local');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

// A dedicated test database wins over the app's: these tests write and delete
// rows, and must not do it to a database people are using.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Integration tests need .env.local (see .env.example).',
  );
}
// Deterministic secrets for tests that exercise encryption round-trips.
process.env.MFA_ENCRYPTION_KEY ??= 'test-mfa-encryption-key-000000000000';
