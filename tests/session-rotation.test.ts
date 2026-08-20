import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';

/**
 * Token rotation must never outrun the cookie that carries the new token.
 *
 * Next.js forbids cookie writes while a server component renders. The original
 * code updated sessions.token_hash first and set the cookie second, so on a
 * page render the throw arrived *after* the write had committed: the database
 * then held the hash of a token the browser had never been given, and the user
 * was silently logged out on their next request while the page 500'd.
 *
 * These tests drive lib/session.ts with a cookie store that refuses writes,
 * standing in for a server component render.
 */

const cookieJar = new Map<string, string>();
let cookieWritesAllowed = true;

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
    set: (name: string, value: string) => {
      if (!cookieWritesAllowed) {
        // The real message Next.js throws in a server component.
        throw new Error(
          'Cookies can only be modified in a Server Action or Route Handler.',
        );
      }
      cookieJar.set(name, value);
    },
    delete: (name: string) => cookieJar.delete(name),
  }),
}));

const { getSession } = await import('@/lib/session');
const { sql, pool } = await import('@/lib/pool');
const { hashPassword } = await import('@/lib/password');

const suffix = randomUUID().slice(0, 8);
const email = `rotation-${suffix}@example.test`;
const COOKIE = 'agri_session';

let userId: string;

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/** Issues a session whose last_used_at is old enough that rotation is due. */
async function issueStaleSession(): Promise<string> {
  const token = `rotation-token-${randomUUID()}`;
  await sql`
    INSERT INTO sessions (user_id, token_hash, session_epoch, last_used_at,
                          expires_at, absolute_expires_at)
    VALUES (${userId}, ${hashToken(token)},
            (SELECT session_epoch FROM users WHERE id = ${userId}),
            now() - interval '2 hours',
            now() + interval '6 hours',
            now() + interval '7 days')
  `;
  cookieJar.set(COOKIE, token);
  return token;
}

async function sessionRow(token: string) {
  const [row] = await sql<{ id: string; expires_at: Date; last_used_at: Date }>`
    SELECT id, expires_at, last_used_at FROM sessions
     WHERE token_hash = ${hashToken(token)}
  `;
  return row ?? null;
}

beforeAll(async () => {
  const [user] = await sql<{ id: string }>`
    INSERT INTO users (email, password_hash, role)
    VALUES (${email}, ${await hashPassword('rotation test passphrase 4')}, 'buyer')
    RETURNING id
  `;
  userId = user!.id;
  await sql`
    INSERT INTO buyers (user_id, name, phone, city)
    VALUES (${userId}, 'Rotation Test', '0770000000', 'Harare')
  `;
});

afterAll(async () => {
  await sql`DELETE FROM users WHERE email = ${email}`;
  await pool.end();
});

describe('rotation in a read-only cookie context (page render)', () => {
  it('keeps the session usable instead of orphaning it', async () => {
    cookieWritesAllowed = false;
    const token = await issueStaleSession();

    const session = await getSession();
    expect(session?.id).toBe(userId);

    // The critical assertion: the token the browser holds still resolves.
    expect(await sessionRow(token)).not.toBeNull();
    expect(cookieJar.get(COOKIE)).toBe(token);
  });

  it('does not throw, so the page still renders', async () => {
    cookieWritesAllowed = false;
    await issueStaleSession();
    await expect(getSession()).resolves.not.toBeNull();
  });

  it('still slides the idle window, so browsing keeps the session alive', async () => {
    cookieWritesAllowed = false;
    const token = await issueStaleSession();

    const before = (await sessionRow(token))!.expires_at;
    await getSession();
    const after = (await sessionRow(token))!.expires_at;

    expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime());
  });

  it('leaves rotation owed rather than silently cancelling it', async () => {
    cookieWritesAllowed = false;
    const token = await issueStaleSession();

    await getSession();

    // last_used_at is what marks rotation as due; refreshing it here would
    // postpone rotation forever for anyone who only browses pages.
    const row = (await sessionRow(token))!;
    const age = Date.now() - new Date(row.last_used_at).getTime();
    expect(age).toBeGreaterThan(60 * 60 * 1000);
  });
});

describe('rotation where cookies can be written (route handler)', () => {
  it('rotates the token and hands the new one to the browser', async () => {
    cookieWritesAllowed = true;
    const token = await issueStaleSession();

    await getSession();

    const issued = cookieJar.get(COOKIE);
    expect(issued).toBeDefined();
    expect(issued).not.toBe(token);

    // The new cookie resolves; the old one no longer does.
    expect(await sessionRow(issued!)).not.toBeNull();
    expect(await sessionRow(token)).toBeNull();
  });

  it('performs the rotation a page render deferred', async () => {
    const token = await issueStaleSession();

    cookieWritesAllowed = false;
    await getSession();
    expect(cookieJar.get(COOKIE)).toBe(token); // deferred

    cookieWritesAllowed = true;
    await getSession();
    expect(cookieJar.get(COOKIE)).not.toBe(token); // then honoured
  });

  it('does not extend the absolute deadline', async () => {
    cookieWritesAllowed = true;
    const token = await issueStaleSession();
    const [before] = await sql<{ absolute_expires_at: Date }>`
      SELECT absolute_expires_at FROM sessions WHERE token_hash = ${hashToken(token)}
    `;

    await getSession();

    const [after] = await sql<{ absolute_expires_at: Date }>`
      SELECT absolute_expires_at FROM sessions
       WHERE token_hash = ${hashToken(cookieJar.get(COOKIE)!)}
    `;
    expect(new Date(after!.absolute_expires_at).getTime())
      .toBe(new Date(before!.absolute_expires_at).getTime());
  });
});
