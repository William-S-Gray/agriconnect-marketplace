import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

/**
 * Email flows, end to end through the route handlers, with the in-memory
 * transport standing in for SMTP.
 */
process.env.SMTP_URL = 'memory://';

const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => { if (value) cookieJar.set(name, value); else cookieJar.delete(name); },
    delete: (name: string) => cookieJar.delete(name),
  }),
  headers: () => new Headers({ origin: 'http://localhost:3000', host: 'localhost:3000' }),
}));

const { sql, pool } = await import('@/lib/pool');
const { outbox } = await import('@/lib/mail');
const register = await import('@/app/api/auth/register/route');
const login = await import('@/app/api/auth/login/route');
const verify = await import('@/app/api/auth/verify/route');
const resend = await import('@/app/api/auth/verify/resend/route');
const forgot = await import('@/app/api/auth/password/forgot/route');

const suffix = randomUUID().slice(0, 8);
const PASSWORD = 'harvest moon over marondera';
const post = (url: string, body: unknown) =>
  new Request(`http://localhost:3000${url}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
const buyer = (email: string) => ({
  role: 'buyer', email, password: PASSWORD, name: 'Tendai Moyo', phone: '0771234567', city: 'Harare',
});
const tokenFrom = (text: string) => /token=([\w-]+)/.exec(text)?.[1] ?? '';

beforeEach(() => { outbox.length = 0; cookieJar.clear(); });

afterAll(async () => {
  await sql`DELETE FROM users WHERE email LIKE ${`%-${suffix}@example.test`}`;
  await sql`DELETE FROM auth_attempts WHERE identifier LIKE ${`%-${suffix}@example.test`}`;
  await pool.end();
});

describe('registration with email configured', () => {
  it('does not sign in, emails a link, and the link confirms and signs in', async () => {
    const email = `new-${suffix}@example.test`;
    const res = await register.POST(post('/api/auth/register', buyer(email)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, verify: true });
    expect(cookieJar.size).toBe(0);

    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.to).toBe(email);
    expect(outbox[0]!.subject).toMatch(/confirm your email/i);
    const token = tokenFrom(outbox[0]!.text);
    expect(token.length).toBeGreaterThan(20);

    // Unverified: the right password is not enough yet.
    const early = await login.POST(post('/api/auth/login', { email, password: PASSWORD }));
    expect(early.status).toBe(403);
    expect((await early.json()).code).toBe('email_unverified');

    const confirmed = await verify.POST(post('/api/auth/verify', { token }));
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).next).toBe('/buyer/dashboard');
    expect(cookieJar.size).toBe(1);

    cookieJar.clear();
    const after = await login.POST(post('/api/auth/login', { email, password: PASSWORD }));
    expect(after.status).toBe(200);
  });

  it('answers an existing address exactly like a new one, and tells its owner by email', async () => {
    const email = `dupe-${suffix}@example.test`;
    await register.POST(post('/api/auth/register', buyer(email)));
    outbox.length = 0; cookieJar.clear();

    const again = await register.POST(post('/api/auth/register', buyer(email)));
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true, verify: true });
    expect(cookieJar.size).toBe(0);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.subject).toMatch(/already have an AgriConnect account/i);
  });

  it('a verification link works once', async () => {
    const email = `once-${suffix}@example.test`;
    await register.POST(post('/api/auth/register', buyer(email)));
    const token = tokenFrom(outbox[0]!.text);
    expect((await verify.POST(post('/api/auth/verify', { token }))).status).toBe(200);
    expect((await verify.POST(post('/api/auth/verify', { token }))).status).toBe(400);
  });

  it('resend answers the same for unknown addresses and only mails a pending one', async () => {
    const unknown = await resend.POST(post('/api/auth/verify/resend', { email: `nobody-${suffix}@example.test` }));
    const unknownBody = await unknown.json();
    expect(outbox).toHaveLength(0);

    const email = `resend-${suffix}@example.test`;
    await register.POST(post('/api/auth/register', buyer(email)));
    const first = tokenFrom(outbox[0]!.text);
    outbox.length = 0;

    const pending = await resend.POST(post('/api/auth/verify/resend', { email }));
    expect(await pending.json()).toEqual(unknownBody);
    expect(outbox).toHaveLength(1);
    // The new link replaces the old one.
    expect((await verify.POST(post('/api/auth/verify', { token: first }))).status).toBe(400);
    expect((await verify.POST(post('/api/auth/verify', { token: tokenFrom(outbox[0]!.text) }))).status).toBe(200);
  });
});

describe('password reset', () => {
  it('actually emails a reset link now', async () => {
    const email = `reset-${suffix}@example.test`;
    await register.POST(post('/api/auth/register', buyer(email)));
    outbox.length = 0;

    const res = await forgot.POST(post('/api/auth/password/forgot', { email }));
    expect(res.status).toBe(200);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.text).toMatch(/\/reset-password\?token=[\w-]{20,}/);
  });

  it('sends nothing for an unknown address, with the same answer', async () => {
    const res = await forgot.POST(post('/api/auth/password/forgot', { email: `ghost-${suffix}@example.test` }));
    expect(res.status).toBe(200);
    expect(outbox).toHaveLength(0);
  });
});

describe('without email configured', () => {
  it('keeps the old behaviour: the account is created and signed in', async () => {
    const saved = process.env.SMTP_URL;
    delete process.env.SMTP_URL;
    try {
      const email = `nomail-${suffix}@example.test`;
      const res = await register.POST(post('/api/auth/register', buyer(email)));
      expect((await res.json()).created).toBe(true);
      expect(cookieJar.size).toBe(1);
      // And can sign in again later — the account was marked verified.
      cookieJar.clear();
      expect((await login.POST(post('/api/auth/login', { email, password: PASSWORD }))).status).toBe(200);
    } finally {
      process.env.SMTP_URL = saved;
    }
  });
});
