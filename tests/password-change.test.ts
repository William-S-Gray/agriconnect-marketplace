import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { generateSync } from 'otplib';

/** Changing your own password, and an admin setting someone else's. */

const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => { cookieJar.set(name, value); },
    delete: (name: string) => cookieJar.delete(name),
  }),
  headers: () => new Headers({ origin: 'http://localhost:3000', host: 'localhost:3000' }),
}));

const { sql, pool } = await import('@/lib/pool');
const { hashPassword, verifyPassword } = await import('@/lib/password');
const { getSession } = await import('@/lib/session');
const { beginEnrolment, confirmEnrolment } = await import('@/lib/mfa');
const own = await import('@/app/api/me/password/route');
const admin = await import('@/app/api/admin/users/password/route');

const COOKIE = 'agri_session';
const OLD = 'original passphrase 42';
const suffix = randomUUID().slice(0, 8);
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

async function makeUser(role: 'buyer' | 'admin', label: string) {
  const [u] = await sql<{ id: string }>`
    INSERT INTO users (email, password_hash, role)
    VALUES (${`${label}-${suffix}@example.test`}, ${await hashPassword(OLD)}, ${role}::user_role)
    RETURNING id`;
  return u!.id;
}

/**
 * Inserts a session at the user's current epoch (a password change bumps it);
 * `use` also makes it the current cookie.
 */
async function session(userId: string, use = true) {
  const token = `pw-${randomUUID()}`;
  await sql`
    INSERT INTO sessions (user_id, token_hash, session_epoch, mfa_satisfied, expires_at, absolute_expires_at)
    SELECT id, ${hashToken(token)}, session_epoch, TRUE, now() + interval '1 hour', now() + interval '1 day'
      FROM users WHERE id = ${userId}`;
  if (use) cookieJar.set(COOKIE, token);
  return token;
}

const revoked = async (token: string) =>
  (await sql<{ r: boolean }>`SELECT revoked_at IS NOT NULL AS r FROM sessions WHERE token_hash = ${hashToken(token)}`)[0]!.r;
const passwordIs = async (userId: string, pw: string) =>
  verifyPassword((await sql<{ h: string }>`SELECT password_hash AS h FROM users WHERE id = ${userId}`)[0]!.h, pw);
const post = (body: unknown) =>
  new Request('http://localhost:3000/api/x', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });

let buyer: string;
let adminId: string;

beforeAll(async () => {
  buyer = await makeUser('buyer', 'pw-buyer');
  adminId = await makeUser('admin', 'pw-admin');
  // Admins must have a second factor to use admin endpoints.
  const challenge = await beginEnrolment(adminId, 'x');
  await confirmEnrolment(adminId, generateSync({ secret: challenge!.secret, digits: 6, period: 30 }));
});

afterAll(async () => {
  await sql`DELETE FROM users WHERE email LIKE ${`%-${suffix}@example.test`}`;
  await sql`DELETE FROM auth_attempts WHERE identifier LIKE ${`%-${suffix}@example.test`}`;
  await pool.end();
});

describe('POST /api/me/password', () => {
  it('refuses a wrong current password and changes nothing', async () => {
    await session(buyer);
    const res = await own.POST(post({ currentPassword: 'not it at all 1', newPassword: 'a brand new passphrase 7' }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('wrong_password');
    expect(await passwordIs(buyer, OLD)).toBe(true);
  });

  it('refuses a weak new password', async () => {
    await session(buyer);
    const res = await own.POST(post({ currentPassword: OLD, newPassword: 'short' }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('weak_password');
  });

  it('changes it, signs out other devices, and keeps this one signed in', async () => {
    const other = await session(buyer, false);
    const current = await session(buyer);
    const res = await own.POST(post({ currentPassword: OLD, newPassword: 'a brand new passphrase 7' }));
    expect(res.status).toBe(200);

    expect(await passwordIs(buyer, 'a brand new passphrase 7')).toBe(true);
    expect(await revoked(other)).toBe(true);
    expect(await revoked(current)).toBe(true);
    // The cookie now holds a fresh session at the new epoch.
    expect(cookieJar.get(COOKIE)).not.toBe(current);
    expect((await getSession())?.id).toBe(buyer);
  });

  it('requires a session', async () => {
    cookieJar.delete(COOKIE);
    const res = await own.POST(post({ currentPassword: OLD, newPassword: 'whatever passphrase 3' }));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/users/password', () => {
  it('is refused to a non-admin', async () => {
    await session(buyer);
    const res = await admin.POST(post({ userId: adminId, password: 'takeover passphrase 99' }));
    expect(res.status).toBe(403);
    expect(await passwordIs(adminId, OLD)).toBe(true);
  });

  it("sets another user's password and signs them out everywhere", async () => {
    const buyerSession = await session(buyer, false);
    await session(adminId);
    const res = await admin.POST(post({ userId: buyer, password: 'set by the admin 2026' }));
    expect(res.status).toBe(200);
    expect(await passwordIs(buyer, 'set by the admin 2026')).toBe(true);
    expect(await revoked(buyerSession)).toBe(true);
  });

  it('refuses the admin\'s own account, which needs the current password', async () => {
    await session(adminId);
    const res = await admin.POST(post({ userId: adminId, password: 'my own new passphrase 5' }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('self_reset');
  });

  it('applies the password policy', async () => {
    await session(adminId);
    const res = await admin.POST(post({ userId: buyer, password: 'password123' }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('weak_password');
  });

  it('404s for an unknown account', async () => {
    await session(adminId);
    const res = await admin.POST(post({ userId: randomUUID(), password: 'nobody home passphrase 1' }));
    expect(res.status).toBe(404);
  });
});
