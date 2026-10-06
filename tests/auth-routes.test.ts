import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { generateSync } from 'otplib';

/**
 * Route-level tests: the defects these cover lived in route handlers, where
 * the lib-only suites could not see them.
 */

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
const { hashPassword } = await import('@/lib/password');
const { beginEnrolment, confirmEnrolment } = await import('@/lib/mfa');
const setup = await import('@/app/api/auth/mfa/setup/route');
const adminUsers = await import('@/app/api/admin/users/route');

const COOKIE = 'agri_session';
const suffix = randomUUID().slice(0, 8);
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

async function makeUser(role: 'buyer' | 'admin', label: string) {
  const [u] = await sql<{ id: string }>`
    INSERT INTO users (email, password_hash, role)
    VALUES (${`${label}-${suffix}@example.test`}, ${await hashPassword('route test passphrase 9')}, ${role}::user_role)
    RETURNING id`;
  return u!.id;
}

async function signIn(userId: string, mfaSatisfied: boolean) {
  const token = `route-${randomUUID()}`;
  await sql`
    INSERT INTO sessions (user_id, token_hash, session_epoch, mfa_satisfied, expires_at, absolute_expires_at)
    VALUES (${userId}, ${hashToken(token)}, 0, ${mfaSatisfied}, now() + interval '1 hour', now() + interval '1 day')`;
  cookieJar.set(COOKIE, token);
  return token;
}

const json = (method: string, body: unknown) =>
  new Request('http://localhost:3000/api/auth/mfa/setup', {
    method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });

let mfaUser: string;
let secret: string;

beforeAll(async () => {
  mfaUser = await makeUser('buyer', 'routes-mfa');
  const challenge = await beginEnrolment(mfaUser, 'x');
  secret = challenge!.secret;
  await confirmEnrolment(mfaUser, generateSync({ secret, digits: 6, period: 30 }));
});

afterAll(async () => {
  await sql`DELETE FROM users WHERE email LIKE ${`%-${suffix}@example.test`}`;
  await sql`DELETE FROM auth_attempts WHERE identifier LIKE ${`%-${suffix}@example.test`}`;
  await pool.end();
});

describe('PUT /api/auth/mfa/setup (F-001)', () => {
  it('refuses a half-authenticated session even with a valid code', async () => {
    const token = await signIn(mfaUser, false);
    const res = await setup.PUT(json('PUT', { code: generateSync({ secret, digits: 6, period: 30 }) }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('mfa_required');

    const [row] = await sql<{ mfa_satisfied: boolean }>`
      SELECT mfa_satisfied FROM sessions WHERE token_hash = ${hashToken(token)}`;
    expect(row!.mfa_satisfied).toBe(false);
  });
});

describe('POST /api/auth/mfa/setup (F-002)', () => {
  it('cannot replace an active factor from a signed-in session', async () => {
    await signIn(mfaUser, true);
    const [before] = await sql<{ mfa_secret: string }>`SELECT mfa_secret FROM users WHERE id = ${mfaUser}`;

    const res = await setup.POST();
    expect(res.status).toBe(409);

    const [after] = await sql<{ mfa_secret: string; mfa_enabled: boolean }>`
      SELECT mfa_secret, mfa_enabled FROM users WHERE id = ${mfaUser}`;
    expect(after!.mfa_secret).toBe(before!.mfa_secret);
    expect(after!.mfa_enabled).toBe(true);
  });
});

describe('admin API without an enrolled second factor (F-004)', () => {
  it('is refused', async () => {
    const admin = await makeUser('admin', 'routes-admin');
    await signIn(admin, true);
    const res = await adminUsers.GET();
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('mfa_enrolment_required');
  });

  it('can still begin enrolment, so the admin is not locked out', async () => {
    const admin = await makeUser('admin', 'routes-admin2');
    await signIn(admin, true);
    const res = await setup.POST();
    expect(res.status).toBe(200);
  });
});
