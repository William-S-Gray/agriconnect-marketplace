// QA harness: HTTP clients with cookie jars, identities, DB access, findings.
import pg from 'pg';
import { generateSync } from 'otplib';

export const BASE = process.env.BASE ?? 'http://localhost:3919';
export const ORIGIN = BASE.replace('127.0.0.1', 'localhost');
export const PW = 'AgriDemo!2026';
export const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const q = async (text, params = []) => (await db.query(text, params)).rows;

export class Client {
  constructor(name) { this.name = name; this.cookie = null; }
  async req(method, path, body, opts = {}) {
    const headers = { ...(opts.headers ?? {}) };
    if (opts.origin !== false) headers.origin = opts.origin ?? ORIGIN;
    if (this.cookie) headers.cookie = this.cookie;
    let payload;
    if (body !== undefined) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      headers['content-type'] ??= 'application/json';
    }
    const res = await fetch(BASE + path, { method, headers, body: payload, redirect: 'manual' });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';'); const [k, v] = pair.split('=');
      if (k.includes('agri_session')) this.cookie = v ? `${k}=${v}` : null;
    }
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, headers: res.headers };
  }
  get(p, o) { return this.req('GET', p, undefined, o); }
  post(p, b, o) { return this.req('POST', p, b, o); }
  patch(p, b, o) { return this.req('PATCH', p, b, o); }
  put(p, b, o) { return this.req('PUT', p, b, o); }
  del(p, b, o) { return this.req('DELETE', p, b, o); }
}

export async function login(name, email, totpSecret) {
  const c = new Client(name);
  const r = await c.post('/api/auth/login', { email, password: PW });
  if (r.status !== 200) throw new Error(`${name} login ${r.status} ${r.text}`);
  if (r.json.mfaRequired && totpSecret) {
    const v = await c.post('/api/auth/mfa/verify', { code: generateSync({ secret: totpSecret, digits: 6, period: 30 }) });
    if (v.status !== 200) throw new Error(`${name} mfa ${v.status} ${v.text}`);
  }
  return c;
}

/** Enrols MFA for an account through the real endpoints; returns the secret. */
export async function enrolMfa(client) {
  const s = await client.post('/api/auth/mfa/setup', {});
  if (s.status !== 200) throw new Error(`enrol ${s.status} ${s.text}`);
  const c = await client.put('/api/auth/mfa/setup', { code: generateSync({ secret: s.json.secret, digits: 6, period: 30 }) });
  if (c.status !== 200) throw new Error(`confirm ${c.status} ${c.text}`);
  return s.json.secret;
}

export const findings = [];
export function check(id, ok, detail) {
  if (!ok) findings.push({ id, detail });
  return ok;
}
export function report(title) {
  console.log(`\n=== ${title}: ${findings.length} finding(s)`);
  for (const f of findings) console.log(`✗ ${f.id}\n    ${typeof f.detail === 'string' ? f.detail : JSON.stringify(f.detail)}`);
}
