import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';

/** Photo upload tokens and attaching/removing photos, with Vercel Blob mocked. */

const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => { cookieJar.set(name, value); },
    delete: (name: string) => cookieJar.delete(name),
  }),
  headers: () => new Headers({ origin: 'http://localhost:3000', host: 'localhost:3000' }),
}));

// What Blob "holds": url -> pathname/contentType. head() throws for anything else.
const store = new Map<string, { pathname: string; contentType: string }>();
const deleted: string[] = [];
vi.mock('@vercel/blob', () => ({
  head: async (url: string) => {
    const b = store.get(url);
    if (!b) throw new Error('BlobNotFoundError');
    return { url, ...b };
  },
  del: async (url: string) => { deleted.push(url); },
}));
const issued: { pathnameCheck?: (p: string) => Promise<unknown> } = {};
vi.mock('@vercel/blob/client', () => ({
  handleUpload: async ({ body, onBeforeGenerateToken }: {
    body: { payload: { pathname: string; clientPayload: string } };
    onBeforeGenerateToken: (p: string, c: string) => Promise<unknown>;
  }) => {
    issued.pathnameCheck = (p) => onBeforeGenerateToken(p, body.payload.clientPayload);
    await onBeforeGenerateToken(body.payload.pathname, body.payload.clientPayload);
    return { type: 'blob.generate-client-token', clientToken: 'tok' };
  },
}));

process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
const { sql, pool } = await import('@/lib/pool');
const { hashPassword } = await import('@/lib/password');
const token = await import('@/app/api/farmer/listings/photos/token/route');
const photos = await import('@/app/api/farmer/listings/photos/route');

const COOKIE = 'agri_session';
const suffix = randomUUID().slice(0, 8);
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
const ids: Record<string, string> = {};

async function user(role: 'farmer' | 'buyer', label: string) {
  const [u] = await sql<{ id: string }>`
    INSERT INTO users (email, password_hash, role)
    VALUES (${`${label}-${suffix}@example.test`}, ${await hashPassword('photo test passphrase 1')}, ${role}::user_role)
    RETURNING id`;
  return u!.id;
}
async function signIn(userId: string) {
  const t = `ph-${randomUUID()}`;
  await sql`
    INSERT INTO sessions (user_id, token_hash, session_epoch, mfa_satisfied, expires_at, absolute_expires_at)
    VALUES (${userId}, ${hashToken(t)}, 0, TRUE, now() + interval '1 hour', now() + interval '1 day')`;
  cookieJar.set(COOKIE, t);
}
const req = (method: string, body: unknown) =>
  new Request('http://localhost:3000/api/x', {
    method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
const tokenBody = (listingId: string, pathname = `listings/${listingId}/photo.jpg`) => ({
  type: 'blob.generate-client-token',
  payload: { pathname, clientPayload: listingId, multipart: false },
});
/** Pretends a browser upload landed in Blob under `pathname`. */
function uploaded(pathname: string, contentType = 'image/jpeg') {
  const url = `https://store.public.blob.vercel-storage.com/${pathname.replace('.jpg', `-${randomUUID().slice(0, 6)}.jpg`)}`;
  store.set(url, { pathname: new URL(url).pathname.slice(1), contentType });
  return url;
}

beforeAll(async () => {
  ids.ownerUser = await user('farmer', 'ph-owner');
  ids.otherUser = await user('farmer', 'ph-other');
  ids.buyerUser = await user('buyer', 'ph-buyer');
  const [f] = await sql<{ id: string }>`
    INSERT INTO farmers (user_id, name, farm_name, province) VALUES (${ids.ownerUser}, 'O', 'Owner Farm', 'Harare') RETURNING id`;
  await sql`INSERT INTO farmers (user_id, name, farm_name, province) VALUES (${ids.otherUser}, 'X', 'Other Farm', 'Harare')`;
  const [l] = await sql<{ id: string }>`
    INSERT INTO listings (farmer_id, title, category, produce_type, quantity_kg, price_per_unit, province)
    VALUES (${f!.id}, 'Photo Tomatoes', 'Vegetables', 'Tomatoes', 100, 1.5, 'Harare') RETURNING id`;
  ids.listing = l!.id;
});

beforeEach(async () => {
  await sql`UPDATE listings SET photos = '{}' WHERE id = ${ids.listing}`;
});

afterAll(async () => {
  await sql`DELETE FROM users WHERE email LIKE ${`%-${suffix}@example.test`}`;
  await pool.end();
});

describe('POST /api/farmer/listings/photos/token', () => {
  it('issues a token to the owner, bound to the listing path', async () => {
    await signIn(ids.ownerUser);
    const res = await token.POST(req('POST', tokenBody(ids.listing)));
    expect(res.status).toBe(200);
    // A path outside this listing is refused at token time.
    await expect(issued.pathnameCheck!(`listings/${randomUUID()}/x.jpg`)).rejects.toThrow();
  });

  it('refuses another farmer, a buyer, and a path outside the listing', async () => {
    await signIn(ids.otherUser);
    expect((await token.POST(req('POST', tokenBody(ids.listing)))).status).toBe(403);
    await signIn(ids.buyerUser);
    expect((await token.POST(req('POST', tokenBody(ids.listing)))).status).toBe(403);
    await signIn(ids.ownerUser);
    expect((await token.POST(req('POST', tokenBody(ids.listing, 'elsewhere/x.jpg')))).status).toBe(400);
  });

  it('accepts only token requests, not upload-completed callbacks', async () => {
    await signIn(ids.ownerUser);
    const res = await token.POST(req('POST', { type: 'blob.upload-completed', payload: {} }));
    expect(res.status).toBe(400);
  });
});

describe('POST/DELETE /api/farmer/listings/photos', () => {
  it('attaches a photo uploaded under this listing', async () => {
    await signIn(ids.ownerUser);
    const url = uploaded(`listings/${ids.listing}/photo.jpg`);
    const res = await photos.POST(req('POST', { listingId: ids.listing, url }));
    expect(res.status).toBe(200);
    expect((await res.json()).photos).toEqual([url]);
  });

  it('refuses a URL that is not in the store, or belongs to another listing', async () => {
    await signIn(ids.ownerUser);
    const foreign = 'https://evil.example/tomato.jpg';
    expect((await photos.POST(req('POST', { listingId: ids.listing, url: foreign }))).status).toBe(400);
    const otherListing = uploaded(`listings/${randomUUID()}/photo.jpg`);
    expect((await photos.POST(req('POST', { listingId: ids.listing, url: otherListing }))).status).toBe(400);
    const notImage = uploaded(`listings/${ids.listing}/photo.jpg`, 'text/html');
    expect((await photos.POST(req('POST', { listingId: ids.listing, url: notImage }))).status).toBe(400);
  });

  it('refuses another farmer', async () => {
    await signIn(ids.otherUser);
    const url = uploaded(`listings/${ids.listing}/photo.jpg`);
    expect((await photos.POST(req('POST', { listingId: ids.listing, url }))).status).toBe(403);
  });

  it('stops at five photos', async () => {
    await signIn(ids.ownerUser);
    for (let i = 0; i < 5; i++) {
      const url = uploaded(`listings/${ids.listing}/photo.jpg`);
      expect((await photos.POST(req('POST', { listingId: ids.listing, url }))).status).toBe(200);
    }
    const sixth = uploaded(`listings/${ids.listing}/photo.jpg`);
    const res = await photos.POST(req('POST', { listingId: ids.listing, url: sixth }));
    expect((await res.json()).code).toBe('too_many');
    expect((await token.POST(req('POST', tokenBody(ids.listing)))).status).toBe(400);
  });

  it('removes a photo and deletes the file', async () => {
    await signIn(ids.ownerUser);
    const url = uploaded(`listings/${ids.listing}/photo.jpg`);
    await photos.POST(req('POST', { listingId: ids.listing, url }));
    const res = await photos.DELETE(req('DELETE', { listingId: ids.listing, url }));
    expect(res.status).toBe(200);
    expect((await res.json()).photos).toEqual([]);
    expect(deleted).toContain(url);
  });
});

describe('without BLOB_READ_WRITE_TOKEN', () => {
  it('is switched off', async () => {
    const saved = process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    try {
      await signIn(ids.ownerUser);
      expect((await token.POST(req('POST', tokenBody(ids.listing)))).status).toBe(503);
    } finally {
      process.env.BLOB_READ_WRITE_TOKEN = saved;
    }
  });
});
