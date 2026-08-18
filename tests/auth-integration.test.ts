import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { sql, pool } from '@/lib/pool';
import { hashPassword, verifyPassword } from '@/lib/password';

/**
 * Integration tests against the development database.
 *
 * These exercise the real queries the auth routes run, rather than mocks, so a
 * schema or query mistake fails here. Every row created is namespaced with a
 * unique suffix and removed afterwards.
 */

const suffix = randomUUID().slice(0, 8);
const buyerEmail = `test-buyer-${suffix}@example.test`;
const farmerEmail = `test-farmer-${suffix}@example.test`;
const PASSWORD = 'integration test passphrase 9';

let buyerUserId: string;
let farmerUserId: string;

beforeAll(async () => {
  const hash = await hashPassword(PASSWORD);

  const [buyer] = await sql<{ id: string }>`
    INSERT INTO users (email, password_hash, role)
    VALUES (${buyerEmail}, ${hash}, 'buyer') RETURNING id
  `;
  buyerUserId = buyer!.id;
  await sql`
    INSERT INTO buyers (user_id, name, phone, city)
    VALUES (${buyerUserId}, 'Test Buyer', '0771234567', 'Harare')
  `;

  const [farmer] = await sql<{ id: string }>`
    INSERT INTO users (email, password_hash, role)
    VALUES (${farmerEmail}, ${hash}, 'farmer') RETURNING id
  `;
  farmerUserId = farmer!.id;
  await sql`
    INSERT INTO farmers (user_id, name, farm_name, province)
    VALUES (${farmerUserId}, 'Test Farmer', 'Test Farm', 'Harare')
  `;
});

afterAll(async () => {
  // ON DELETE CASCADE removes the profile, session and token rows.
  await sql`DELETE FROM users WHERE email IN (${buyerEmail}, ${farmerEmail})`;
  await sql`DELETE FROM auth_attempts WHERE identifier LIKE ${`%${suffix}%`}`;
  await pool.end();
});

describe('credential verification', () => {
  it('accepts the correct password for a real account', async () => {
    const [user] = await sql<{ password_hash: string }>`
      SELECT password_hash FROM users WHERE email = ${buyerEmail}
    `;
    expect(await verifyPassword(user!.password_hash, PASSWORD)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const [user] = await sql<{ password_hash: string }>`
      SELECT password_hash FROM users WHERE email = ${buyerEmail}
    `;
    expect(await verifyPassword(user!.password_hash, 'wrong passphrase here')).toBe(false);
  });

  it('stores no plaintext password anywhere in the users table', async () => {
    const rows = await sql<{ n: string }>`
      SELECT count(*) AS n FROM users WHERE password_hash = ${PASSWORD}
    `;
    expect(Number(rows[0]!.n)).toBe(0);
  });

  it('stores every password as Argon2id', async () => {
    const rows = await sql<{ n: string }>`
      SELECT count(*) AS n FROM users WHERE password_hash NOT LIKE '$argon2id$%'
    `;
    expect(Number(rows[0]!.n)).toBe(0);
  });

  it('finds no user for an unregistered email (no implicit account creation)', async () => {
    const rows = await sql`
      SELECT id FROM users WHERE email = ${`nobody-${suffix}@example.test`}
    `;
    expect(rows).toHaveLength(0);
  });
});

describe('seeded demo accounts', () => {
  it('the documented demo password works for the seeded admin', async () => {
    const [admin] = await sql<{ password_hash: string; role: string }>`
      SELECT password_hash, role FROM users WHERE email = 'admin@agriconnect.co.zw'
    `;
    expect(admin?.role).toBe('admin');
    expect(await verifyPassword(admin!.password_hash, 'AgriDemo!2026')).toBe(true);
  });

  it('the retired demo password no longer works', async () => {
    const [admin] = await sql<{ password_hash: string }>`
      SELECT password_hash FROM users WHERE email = 'admin@agriconnect.co.zw'
    `;
    expect(await verifyPassword(admin!.password_hash, 'Demo@1234')).toBe(false);
  });

  it('only the canonical address holds the admin role', async () => {
    // Scoped to non-test accounts on purpose: sibling test files create their
    // own admin users in this same database, so asserting a global count of 1
    // couples this test to whatever else happens to be running.
    const admins = await sql<{ email: string }>`
      SELECT email FROM users
       WHERE role = 'admin' AND email NOT LIKE '%@example.test'
    `;
    expect(admins).toHaveLength(1);
    expect(admins[0]!.email).toBe('admin@agriconnect.co.zw');
  });

  it('no look-alike address has been granted the admin role', async () => {
    // Guards the original bug: admin was granted to any email *containing*
    // "admin", so these must never appear with the role.
    const lookalikes = await sql<{ email: string }>`
      SELECT email FROM users
       WHERE role = 'admin' AND email <> 'admin@agriconnect.co.zw'
         AND email NOT LIKE '%@example.test'
    `;
    expect(lookalikes).toEqual([]);
  });
});

describe('role integrity', () => {
  it('rejects a role value outside the enum (client cannot invent roles)', async () => {
    await expect(
      sql`UPDATE users SET role = 'superadmin' WHERE id = ${buyerUserId}`,
    ).rejects.toThrow();
  });

  it('a buyer has no farmer profile, so farmer-scoped lookups find nothing', async () => {
    const rows = await sql`SELECT id FROM farmers WHERE user_id = ${buyerUserId}`;
    expect(rows).toHaveLength(0);
  });

  it('enforces the lowercase-email constraint', async () => {
    await expect(
      sql`
        INSERT INTO users (email, password_hash, role)
        VALUES (${`MiXeD-${suffix}@Example.Test`}, 'x', 'buyer')
      `,
    ).rejects.toThrow();
  });
});

describe('session storage', () => {
  it('stores only a hash of the session token, never the token itself', async () => {
    const token = 'plaintext-session-token-value';
    const tokenHash = createHash('sha256').update(token).digest('hex');

    await sql`
      INSERT INTO sessions (user_id, token_hash, expires_at, absolute_expires_at)
      VALUES (${buyerUserId}, ${tokenHash},
              now() + interval '1 hour', now() + interval '7 days')
    `;

    const byToken = await sql`SELECT id FROM sessions WHERE token_hash = ${token}`;
    expect(byToken).toHaveLength(0);

    const byHash = await sql`SELECT id FROM sessions WHERE token_hash = ${tokenHash}`;
    expect(byHash).toHaveLength(1);
  });

  it('a bumped session_epoch orphans existing sessions', async () => {
    const [user] = await sql<{ session_epoch: number }>`
      SELECT session_epoch FROM users WHERE id = ${buyerUserId}
    `;
    const epochAtIssue = user!.session_epoch;

    await sql`
      INSERT INTO sessions (user_id, token_hash, session_epoch, expires_at, absolute_expires_at)
      VALUES (${buyerUserId}, ${`epoch-test-${suffix}`}, ${epochAtIssue},
              now() + interval '1 hour', now() + interval '7 days')
    `;

    // Simulates a password change.
    await sql`UPDATE users SET session_epoch = session_epoch + 1 WHERE id = ${buyerUserId}`;

    const stale = await sql<{ stale: boolean }>`
      SELECT (s.session_epoch <> u.session_epoch) AS stale
        FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ${`epoch-test-${suffix}`}
    `;
    expect(stale[0]!.stale).toBe(true);
  });
});

describe('password reset tokens', () => {
  it('stores only the hash, expires, and can be claimed exactly once', async () => {
    const token = `reset-token-${suffix}`;
    const tokenHash = createHash('sha256').update(token).digest('hex');

    await sql`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (${buyerUserId}, ${tokenHash}, now() + interval '30 minutes')
    `;

    // The plaintext token is not stored.
    const raw = await sql`SELECT id FROM password_reset_tokens WHERE token_hash = ${token}`;
    expect(raw).toHaveLength(0);

    const claim = () => sql<{ user_id: string }>`
      UPDATE password_reset_tokens SET used_at = now()
       WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > now()
       RETURNING user_id
    `;

    expect(await claim()).toHaveLength(1); // first use succeeds
    expect(await claim()).toHaveLength(0); // replay refused
  });

  it('refuses an expired token', async () => {
    const tokenHash = createHash('sha256').update(`expired-${suffix}`).digest('hex');
    await sql`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (${buyerUserId}, ${tokenHash}, now() - interval '1 minute')
    `;

    const claimed = await sql`
      UPDATE password_reset_tokens SET used_at = now()
       WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > now()
       RETURNING user_id
    `;
    expect(claimed).toHaveLength(0);
  });
});
