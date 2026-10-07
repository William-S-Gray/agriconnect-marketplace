// Round 1: authorization, CSRF, input fuzzing, business rules, sessions,
// headers, XSS and enumeration.
// One full QA round against the running server. Exit code = number of findings.
import { Client, login, enrolMfa, q, db, check, report, findings, ORIGIN, PW } from './lib.mjs';
import { generateSync } from 'otplib';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const SECRET_FILE = new URL('./.admin-totp', import.meta.url);

const section = (s) => console.log(`\n── ${s}`);

// ─── Identities ──────────────────────────────────────────────────────────────
section('identities');
const anon = new Client('anon');
const buyerA = await login('buyerA', 'kuda@email.co.zw');
const buyerB = await login('buyerB', 'procurement@hararefresh.co.zw');
const farmerA = await login('farmerA', 'john@moyofarm.co.zw');
const farmerB = await login('farmerB', 'patrick@ncubefarm.co.zw');

// A second admin without MFA, created directly (test database only).
await q(`INSERT INTO users (email, password_hash, role, email_verified_at)
         SELECT 'admin2@agriconnect.co.zw', password_hash, 'admin', now() FROM users WHERE email = 'admin@agriconnect.co.zw'
         ON CONFLICT (email) DO NOTHING`);
const adminU = await login('adminU', 'admin2@agriconnect.co.zw');

// The seeded admin enrols MFA through the real endpoints, then signs in fully.
let adminSecret = (await q(`SELECT mfa_enabled FROM users WHERE email='admin@agriconnect.co.zw'`))[0].mfa_enabled
  && existsSync(SECRET_FILE) ? readFileSync(SECRET_FILE, 'utf8') : null;
if (!adminSecret) { adminSecret = await enrolMfa(await login('adminE', 'admin@agriconnect.co.zw')); writeFileSync(SECRET_FILE, adminSecret); }
await new Promise((r) => setTimeout(r, 31_000)); // a fresh TOTP step, so the code is not a replay
const adminM = await login('adminM', 'admin@agriconnect.co.zw', adminSecret);

// A half-authenticated session: password passed, MFA pending.
const mfaUser = await login('mfaUser', 'supply@chiporestaurants.co.zw');
const mfaSecret = (await q(`SELECT mfa_enabled FROM users WHERE email='supply@chiporestaurants.co.zw'`))[0].mfa_enabled
  ? null : await enrolMfa(mfaUser);
const half = new Client('half');
await half.post('/api/auth/login', { email: 'supply@chiporestaurants.co.zw', password: PW });
console.log('identities ready');

const ids = (await q(`
  SELECT (SELECT l.id FROM listings l JOIN farmers f ON f.id=l.farmer_id JOIN users u ON u.id=f.user_id
           WHERE u.email='john@moyofarm.co.zw' AND l.status='ACTIVE' ORDER BY l.created_at LIMIT 1) AS listing_a,
         (SELECT l.id FROM listings l JOIN farmers f ON f.id=l.farmer_id JOIN users u ON u.id=f.user_id
           WHERE u.email='patrick@ncubefarm.co.zw' AND l.status='ACTIVE' ORDER BY l.created_at LIMIT 1) AS listing_b,
         (SELECT o.id FROM orders o JOIN buyers b ON b.id=o.buyer_id JOIN users u ON u.id=b.user_id
           JOIN farmers f ON f.id=o.farmer_id JOIN users fu ON fu.id=f.user_id
           WHERE u.email='kuda@email.co.zw' AND fu.email='john@moyofarm.co.zw' LIMIT 1) AS order_a,
         (SELECT id FROM users WHERE email='patrick@ncubefarm.co.zw') AS farmer_b_user`))[0];
console.log(ids);

// ─── 1. Authorization matrix ─────────────────────────────────────────────────
section('authorization matrix');
const who = { anon, buyerA, buyerB, farmerA, farmerB, adminU, adminM, half };
// expect: identity -> allowed status (number) or set of acceptable statuses
const DENY = (s) => (x) => x === s;
const OK = (x) => x >= 200 && x < 300;
const NOTOK = (x) => x === 401 || x === 403 || x === 404;
const matrix = [
  ['GET', '/api/admin/users', undefined, { anon: DENY(401), buyerA: DENY(403), farmerA: DENY(403), adminU: DENY(403), half: DENY(403), adminM: OK }],
  ['PATCH', '/api/admin/users', { userId: ids.farmer_b_user, action: 'reactivate' }, { anon: DENY(401), buyerA: DENY(403), farmerA: DENY(403), adminU: DENY(403), half: DENY(403), adminM: OK }],
  ['PATCH', '/api/admin/security', { eventId: '00000000-0000-0000-0000-000000000000' }, { anon: DENY(401), buyerA: DENY(403), farmerA: DENY(403), adminU: DENY(403), half: DENY(403), adminM: DENY(404) }],
  ['GET', '/api/buyer/cart', undefined, { anon: DENY(401), farmerA: DENY(403), adminM: DENY(403), half: DENY(403), buyerA: OK }],
  ['POST', '/api/buyer/orders', {}, { anon: DENY(401), farmerA: DENY(403), adminM: DENY(403), half: DENY(403) }],
  ['POST', '/api/farmer/listings', { title: 'x' }, { anon: DENY(401), buyerA: DENY(403), adminM: DENY(403), half: DENY(403) }],
  ['PATCH', '/api/farmer/listings', { id: ids.listing_b, price_per_unit: 0.01 }, { anon: DENY(401), buyerA: DENY(403), farmerA: DENY(403), half: DENY(403) }],
  ['GET', `/api/orders/${ids.order_a}`, undefined, { anon: DENY(401), buyerB: DENY(404), farmerB: DENY(404), half: DENY(403), buyerA: OK, farmerA: OK, adminM: OK }],
  ['PATCH', `/api/orders/${ids.order_a}`, { action: 'cancel' }, { anon: DENY(401), buyerB: DENY(404), farmerB: DENY(404), half: DENY(403) }],
  ['POST', `/api/orders/${ids.order_a}/review`, { rating: 5 }, { anon: DENY(401), buyerB: DENY(404), farmerB: DENY(404), farmerA: DENY(404), half: DENY(403) }],
  ['PATCH', '/api/me', { name: 'Changed Name' }, { anon: DENY(401), half: DENY(403) }],
  ['POST', '/api/auth/mfa/setup', {}, { anon: DENY(401), half: DENY(403) }],
  ['DELETE', '/api/auth/mfa/setup', { password: PW }, { anon: DENY(401), half: DENY(403) }],
];
for (const [method, path, body, expect] of matrix) {
  for (const [name, test] of Object.entries(expect)) {
    const r = await who[name].req(method, path, body);
    check(`authz ${method} ${path} as ${name}`, test(r.status), `got ${r.status} ${r.text.slice(0, 120)}`);
  }
}

// ─── 2. CSRF on every mutating route ─────────────────────────────────────────
section('csrf');
const mutating = [
  ['POST', '/api/auth/login', { email: 'kuda@email.co.zw', password: PW }],
  ['POST', '/api/auth/logout'], ['POST', '/api/auth/register', {}], ['POST', '/api/auth/password/forgot', { email: 'a@b.co' }],
  ['POST', '/api/auth/password/reset', {}], ['POST', '/api/auth/verify', {}], ['POST', '/api/auth/verify/resend', {}],
  ['POST', '/api/auth/mfa/setup', {}], ['PUT', '/api/auth/mfa/setup', {}], ['DELETE', '/api/auth/mfa/setup', {}],
  ['POST', '/api/auth/mfa/verify', {}], ['POST', '/api/buyer/cart', {}], ['PATCH', '/api/buyer/cart', {}], ['DELETE', '/api/buyer/cart'],
  ['POST', '/api/buyer/orders', {}], ['POST', '/api/farmer/listings', {}], ['PATCH', '/api/farmer/listings', {}],
  ['PATCH', '/api/me', {}], ['PATCH', `/api/orders/${ids.order_a}`, {}], ['POST', `/api/orders/${ids.order_a}/review`, {}],
  ['PATCH', '/api/admin/users', {}], ['PATCH', '/api/admin/security', {}],
];
for (const [method, path, body] of mutating) {
  for (const [label, origin] of [['evil origin', 'https://evil.example'], ['no origin', false], ['null origin', 'null']]) {
    const r = await buyerA.req(method, path, body, { origin });
    check(`csrf ${label} ${method} ${path}`, r.status === 403 && r.json?.code === 'csrf', `got ${r.status}`);
  }
}
// The CSRF note claims JSON-only bodies as a layer; a text/plain body (what an HTML form can send) must not be accepted.
{
  const r = await buyerA.req('PATCH', '/api/me', '{"name":"Form Submitted"}', { headers: { 'content-type': 'text/plain' } });
  check('csrf text/plain body accepted on a JSON route', r.status === 415 || r.status === 400, `got ${r.status} ${r.text.slice(0, 80)}`);
}

// ─── 3. Input fuzzing: nothing may 500 ───────────────────────────────────────
section('fuzzing');
const bodies = [
  ['array', '[]'], ['string', '"x"'], ['null', 'null'], ['number', '42'], ['proto', '{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"x":1}}}'],
  ['broken json', '{"a":'], ['deep', '['.repeat(5000) + ']'.repeat(5000)],
];
const fuzzTargets = [
  [buyerA, 'POST', '/api/buyer/cart'], [buyerA, 'PATCH', '/api/buyer/cart'], [buyerA, 'POST', '/api/buyer/orders'],
  [farmerA, 'POST', '/api/farmer/listings'], [farmerA, 'PATCH', '/api/farmer/listings'], [buyerA, 'PATCH', '/api/me'],
  [buyerA, 'PATCH', `/api/orders/${ids.order_a}`], [buyerA, 'POST', `/api/orders/${ids.order_a}/review`],
  [anon, 'POST', '/api/auth/login'], [anon, 'POST', '/api/auth/register'], [anon, 'POST', '/api/auth/password/forgot'],
  [anon, 'POST', '/api/auth/password/reset'], [anon, 'POST', '/api/auth/verify'], [anon, 'POST', '/api/auth/verify/resend'],
  [adminM, 'PATCH', '/api/admin/users'], [adminM, 'PATCH', '/api/admin/security'],
];
for (const [client, method, path] of fuzzTargets) {
  for (const [label, raw] of bodies) {
    const r = await client.req(method, path, raw);
    check(`fuzz ${label} ${method} ${path}`, r.status < 500, `got ${r.status} ${r.text.slice(0, 100)}`);
  }
}
const numbers = [-1, 0, 0.0001, 1e308, '1e309', 'NaN', 'Infinity', '12abc', 99999999999, 1.23456789];
for (const n of numbers) {
  const r1 = await buyerA.post('/api/buyer/cart', { listingId: ids.listing_a, quantity: n });
  check(`fuzz cart quantity ${n}`, r1.status < 500 && !(r1.status === 200 && (Number(n) <= 0 || !Number.isFinite(Number(n)))), `got ${r1.status} ${r1.text.slice(0, 80)}`);
  const r2 = await farmerA.patch('/api/farmer/listings', { id: ids.listing_a, price_per_unit: n });
  check(`fuzz listing price ${n}`, r2.status < 500 && !(r2.status === 200 && (!Number.isFinite(Number(n)) || Number(n) < 0)), `got ${r2.status}`);
}
await buyerA.del('/api/buyer/cart');
await farmerA.patch('/api/farmer/listings', { id: ids.listing_a, price_per_unit: 0.85 });
for (const id of ['not-a-uuid', '00000000-0000-0000-0000-000000000000', "1' OR '1'='1", '../../etc/passwd']) {
  const r = await buyerA.get(`/api/orders/${encodeURIComponent(id)}`);
  check(`fuzz order id ${id}`, r.status === 404, `got ${r.status}`);
}
for (const qs of ['page=-5', 'page=abc', 'page=1e9', "sort='; DROP TABLE listings;--", 'q=%25%25%25', 'q=' + 'a'.repeat(5000), 'province=%00']) {
  const r = await anon.get(`/browse?${qs}`);
  check(`fuzz browse ${qs.slice(0, 30)}`, r.status === 200, `got ${r.status}`);
}
{ // A large request body must be refused, not buffered.
  const big = JSON.stringify({ name: 'x'.repeat(20 * 1024 * 1024) });
  const t0 = Date.now();
  const r = await buyerA.req('PATCH', '/api/me', big);
  check('oversized body (20 MB) refused early', r.status === 413, `got ${r.status} after ${Date.now() - t0}ms`);
}

// Edge values that used to reach the database's CHECK constraints or NUL handling.
{
  const tiny = await buyerA.post('/api/buyer/cart', { listingId: ids.listing_a, quantity: 10.0001 });
  check('quantity with >2 decimals refused', tiny.status === 400, `got ${tiny.status}`);
  await buyerA.post('/api/buyer/cart', { listingId: ids.listing_a, quantity: 10 });
  const tinyPatch = await buyerA.patch('/api/buyer/cart', { listingId: ids.listing_a, quantity: 0.0001 });
  check('cart PATCH 0.0001 does not 500', tinyPatch.status === 400, `got ${tinyPatch.status}`);
  await buyerA.del('/api/buyer/cart');
  await q(`UPDATE listings SET quantity_kg = 0 WHERE id = $1`, [ids.listing_b]);
  const empty = await buyerA.post('/api/buyer/cart', { listingId: ids.listing_b, quantity: 1 });
  check('zero-stock listing cannot be added', empty.status === 409, `got ${empty.status}`);
  await q(`UPDATE listings SET quantity_kg = 100 WHERE id = $1`, [ids.listing_b]);
  const unit = await farmerA.post('/api/farmer/listings', { title: 'Odd Unit', category: 'Vegetables', produce_type: 'Kale', quantity_kg: 10, quantity_unit: 'barrels', price_per_unit: 1, province: 'Harare' });
  check('invented unit refused', unit.status === 400, `got ${unit.status}`);
  const cat = await farmerA.post('/api/farmer/listings', { title: 'Odd Cat', category: 'Spaceships', produce_type: 'Kale', quantity_kg: 10, quantity_unit: 'kg', price_per_unit: 1, province: 'Harare' });
  check('invented category refused', cat.status === 400, `got ${cat.status}`);
  const prov = await buyerA.patch('/api/me', { city: 'Harare' });
  check('buyer profile update still works', prov.status === 200, `got ${prov.status}`);
  for (const [label, run] of [
    ['search q', () => anon.get('/browse?q=to%00ma')],
    ['profile name', () => buyerA.patch('/api/me', { name: 'Kuda\u0000 Matongo' })],
    ['login email', () => anon.post('/api/auth/login', { email: 'ku\u0000da@email.co.zw', password: 'x' })],
  ]) { const r = await run(); check(`NUL byte in ${label} does not 500`, r.status < 500, `got ${r.status}`); }
  await buyerA.patch('/api/me', { name: 'Kudakwashe Matongo' });
}

// ─── 4. Business logic ───────────────────────────────────────────────────────
section('business logic');
// Fractional units: half a chicken, a third of a crate.
{
  const [l] = await q(`SELECT id, quantity_unit, min_order_qty FROM listings WHERE quantity_unit IN ('head','crate','bag','tray') AND status='ACTIVE' LIMIT 1`);
  if (l) {
    const r = await buyerA.post('/api/buyer/cart', { listingId: l.id, quantity: Number(l.min_order_qty) + 0.5 });
    check(`fractional quantity for unit '${l.quantity_unit}'`, r.status === 400, `got ${r.status}`);
    await buyerA.del('/api/buyer/cart');
  }
}
// Below minimum order.
{
  const [l] = await q(`SELECT id, min_order_qty FROM listings WHERE min_order_qty > 1 AND status='ACTIVE' LIMIT 1`);
  if (l) { const r = await buyerA.post('/api/buyer/cart', { listingId: l.id, quantity: 1 }); check('below minimum order refused', r.status === 400, `got ${r.status}`); }
}
// Cart quantity edited below the minimum after adding.
{
  const [l] = await q(`SELECT id, min_order_qty FROM listings WHERE min_order_qty > 1 AND status='ACTIVE' LIMIT 1`);
  if (l) {
    await buyerA.post('/api/buyer/cart', { listingId: l.id, quantity: Number(l.min_order_qty) });
    const r = await buyerA.patch('/api/buyer/cart', { listingId: l.id, quantity: 1 });
    const [row] = await q(`SELECT c.quantity FROM cart_items c JOIN buyers b ON b.id=c.buyer_id JOIN users u ON u.id=b.user_id WHERE u.email='kuda@email.co.zw' AND c.listing_id=$1`, [l.id]);
    check('cart PATCH below minimum order refused', !(row && Number(row.quantity) < Number(l.min_order_qty)), `PATCH ${r.status}, cart holds ${row?.quantity}, minimum ${l.min_order_qty}`);
    await buyerA.del('/api/buyer/cart');
  }
}
// Overselling under concurrency: two buyers race for the last units.
{
  const lid = ids.listing_b;
  await q(`UPDATE listings SET quantity_kg = 10, min_order_qty = 1 WHERE id = $1`, [lid]);
  await buyerA.post('/api/buyer/cart', { listingId: lid, quantity: 10 });
  await buyerB.post('/api/buyer/cart', { listingId: lid, quantity: 10 });
  const [r1, r2] = await Promise.all([buyerA.post('/api/buyer/orders', { deliveryMethod: 'PICKUP' }), buyerB.post('/api/buyer/orders', { deliveryMethod: 'PICKUP' })]);
  const [l] = await q(`SELECT quantity_kg FROM listings WHERE id=$1`, [lid]);
  const okCount = [r1, r2].filter((r) => r.status === 200).length;
  check('concurrent checkout cannot oversell', okCount === 1 && Number(l.quantity_kg) >= 0, `successes ${okCount}, stock now ${l.quantity_kg}`);
  await buyerA.del('/api/buyer/cart'); await buyerB.del('/api/buyer/cart');
}
// Price is taken from the listing, not the client.
{
  await buyerA.post('/api/buyer/cart', { listingId: ids.listing_a, quantity: 10, price: 0.01, price_per_unit: 0.01, total: 0.01 });
  const r = await buyerA.post('/api/buyer/orders', { deliveryMethod: 'PICKUP', total_amount: 0.01, unit_price: 0.01 });
  const [o] = await q(`SELECT unit_price, total_amount, quantity FROM orders WHERE reference = $1`, [r.json?.references?.[0] ?? '']);
  const [l] = await q(`SELECT price_per_unit FROM listings WHERE id=$1`, [ids.listing_a]);
  check('client cannot set the price', o && Number(o.unit_price) === Number(l.price_per_unit), JSON.stringify({ status: r.status, o, l }));
}
// Delivery without an address.
{
  await buyerA.post('/api/buyer/cart', { listingId: ids.listing_a, quantity: 10 });
  const r = await buyerA.post('/api/buyer/orders', { deliveryMethod: 'DELIVERY' });
  check('DELIVERY order requires an address', r.status === 400, `got ${r.status}`);
  await buyerA.del('/api/buyer/cart');
}
// Concurrent conflicting transitions on one order.
{
  await buyerA.post('/api/buyer/cart', { listingId: ids.listing_a, quantity: 10 });
  const placed = await buyerA.post('/api/buyer/orders', { deliveryMethod: 'PICKUP' });
  const [o] = await q(`SELECT id FROM orders WHERE reference=$1`, [placed.json?.references?.[0] ?? '']);
  if (o) {
    const [stock0] = await q(`SELECT quantity_kg FROM listings WHERE id=$1`, [ids.listing_a]);
    const [c1, c2, c3] = await Promise.all([
      buyerA.patch(`/api/orders/${o.id}`, { action: 'cancel' }),
      farmerA.patch(`/api/orders/${o.id}`, { action: 'cancel' }),
      farmerA.patch(`/api/orders/${o.id}`, { action: 'confirm' }),
    ]);
    const [stock1] = await q(`SELECT quantity_kg FROM listings WHERE id=$1`, [ids.listing_a]);
    const cancels = [c1, c2].filter((r) => r.status === 200).length;
    check('stock restored at most once under racing cancels', cancels <= 1 && Number(stock1.quantity_kg) - Number(stock0.quantity_kg) <= 10,
      { statuses: [c1.status, c2.status, c3.status], stock0: stock0.quantity_kg, stock1: stock1.quantity_kg });
  }
}
// Double review race.
{
  await buyerA.post('/api/buyer/cart', { listingId: ids.listing_a, quantity: 10 });
  const placed = await buyerA.post('/api/buyer/orders', { deliveryMethod: 'PICKUP' });
  const [o] = await q(`SELECT id FROM orders WHERE reference=$1`, [placed.json?.references?.[0] ?? '']);
  for (const a of ['confirm', 'dispatch', 'mark_delivered']) await farmerA.patch(`/api/orders/${o.id}`, { action: a });
  await buyerA.patch(`/api/orders/${o.id}`, { action: 'confirm_receipt' });
  const rs = await Promise.all([1, 2, 3].map(() => buyerA.post(`/api/orders/${o.id}/review`, { rating: 5 })));
  const [{ n }] = await q(`SELECT count(*)::int n FROM reviews WHERE order_id=$1`, [o.id]);
  check('one review per order under concurrency', n === 1 && rs.filter((r) => r.status === 200).length === 1, rs.map((r) => r.status));
  // Escrow released and farmer credited exactly once.
  const again = await buyerA.patch(`/api/orders/${o.id}`, { action: 'confirm_receipt' });
  check('receipt cannot be confirmed twice', again.status === 409, `got ${again.status}`);
}
// Mass assignment on listing create.
{
  const r = await farmerA.post('/api/farmer/listings', {
    title: 'Mass Assign Test', category: 'Vegetables', produce_type: 'Kale', quantity_kg: 10, quantity_unit: 'kg',
    price_per_unit: 1, province: 'Harare', farmer_id: '00000000-0000-0000-0000-000000000000', status: 'REMOVED', views_count: 99999,
  });
  const [l] = await q(`SELECT l.status, l.views_count, u.email FROM listings l JOIN farmers f ON f.id=l.farmer_id JOIN users u ON u.id=f.user_id WHERE l.id=$1`, [r.json?.id]);
  check('listing create ignores farmer_id/status/views', l && l.email === 'john@moyofarm.co.zw' && l.status === 'ACTIVE' && l.views_count === 0, JSON.stringify(l));
}
// Profile escalation attempt.
{
  const r = await buyerA.patch('/api/me', { role: 'admin', name: 'Kudakwashe Matongo' });
  const [u] = await q(`SELECT role FROM users WHERE email='kuda@email.co.zw'`);
  check('profile update cannot change role', u.role === 'buyer', `role ${u.role}, status ${r.status}`);
}

// ─── 5. Sessions, rate limits, headers ───────────────────────────────────────
section('sessions & limits');
{
  const c = await login('tmp', 'grace@sibandafarm.co.zw');
  const r = await c.req('GET', '/api/auth/session'); const raw = r.headers.get('set-cookie') ?? '';
  const stolen = c.cookie;
  await c.post('/api/auth/logout');
  const replay = new Client('replay'); replay.cookie = stolen;
  const after = await replay.get('/api/auth/session');
  check('logged-out cookie is dead', after.json?.authenticated === false, `got ${after.status} ${after.text.slice(0, 80)}`);
  const lr = await new Client('x').post('/api/auth/login', { email: 'grace@sibandafarm.co.zw', password: PW });
  const sc = (lr.headers.getSetCookie?.() ?? []).join(' ');
  check('session cookie flags', /HttpOnly/i.test(sc) && /SameSite=Lax/i.test(sc) && /Path=\//.test(sc), sc);
}
{
  const c = new Client('brute'); const statuses = [];
  for (let i = 0; i < 9; i++) statuses.push((await c.post('/api/auth/login', { email: 'tatenda@chikwanda.co.zw', password: `wrong-${i}` })).status);
  check('login brute force throttled', statuses.includes(429), statuses.join(','));
  const spoof = []; // rotating X-Forwarded-For must not reset the per-account limit
  for (let i = 0; i < 4; i++) spoof.push((await c.post('/api/auth/login', { email: 'tatenda@chikwanda.co.zw', password: 'x' }, { headers: { 'x-forwarded-for': `10.0.${i}.1` } })).status);
  check('per-account limit survives spoofed XFF', spoof.every((s) => s === 429), spoof.join(','));
}
{
  const codes = [];
  for (let i = 0; i < 10; i++) codes.push((await half.post('/api/auth/mfa/verify', { code: String(100000 + i) })).status);
  check('MFA guessing throttled', codes.includes(429), codes.join(','));
}
{
  const r = await buyerA.get('/api/buyer/cart');
  check('authenticated API responses are not cacheable', /no-store|private/.test(r.headers.get('cache-control') ?? ''), `cache-control: ${r.headers.get('cache-control')}`);
  const page = await buyerA.get('/buyer/orders');
  check('authenticated pages are not cacheable', /no-store|private/.test(page.headers.get('cache-control') ?? ''), `cache-control: ${page.headers.get('cache-control')}`);
  const h = await anon.get('/');
  for (const [k, re] of [['content-security-policy', /nonce-/], ['x-frame-options', /DENY/], ['x-content-type-options', /nosniff/], ['referrer-policy', /strict-origin/]]) {
    check(`header ${k}`, re.test(h.headers.get(k) ?? ''), h.headers.get(k));
  }
  check('no x-powered-by', !h.headers.get('x-powered-by'), h.headers.get('x-powered-by'));
}

// ─── 6. XSS, redirects, leakage, enumeration ─────────────────────────────────
section('xss / redirects / leakage');
{
  const xss = `<img src=x onerror=alert(1)>"'><script>alert(2)</script>`;
  const r = await farmerA.post('/api/farmer/listings', { title: `XSS ${xss}`.slice(0, 160), description: xss, category: 'Vegetables', produce_type: 'Kale', quantity_kg: 10, quantity_unit: 'kg', price_per_unit: 1, province: 'Harare' });
  await buyerA.patch('/api/me', { name: `Kuda ${xss}`.slice(0, 120) });
  const pages = await Promise.all([anon.get('/browse'), anon.get(`/listing/${r.json?.id}`), farmerA.get('/farm/listings')]);
  for (const p of pages) check('stored XSS rendered raw', !p.text.includes('<script>alert(2)</script>') && !p.text.includes('<img src=x onerror'), 'raw payload in HTML');
  await buyerA.patch('/api/me', { name: 'Kudakwashe Matongo' });
}
for (const next of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)']) {
  const r = await anon.get(`/login?next=${encodeURIComponent(next)}`);
  // The URL itself is echoed in Next's router state; what matters is whether
  // it reaches the login form as its post-sign-in destination.
  const dest = /\\?"nextPath\\?":\\?"([^"\\]*)/.exec(r.text)?.[1] ?? null;
  check(`open redirect via next=${next}`, dest === null || dest === "$undefined" || (dest.startsWith('/') && !dest.startsWith('//')), `nextPath=${dest}`);
}
{
  const r = await anon.get('/api/orders/00000000-0000-0000-0000-000000000000');
  check('errors do not leak internals', !/at \w+ \(|node_modules|postgres|SELECT /i.test(r.text), r.text.slice(0, 120));
}
{ // Enumeration: identical answers for existing and unknown accounts.
  const a = await anon.post('/api/auth/password/forgot', { email: 'kuda@email.co.zw' });
  const b = await anon.post('/api/auth/password/forgot', { email: 'nobody-qa@example.test' });
  check('forgot-password does not enumerate', a.status === b.status && a.text === b.text, [a.text, b.text]);
  const l1 = await anon.post('/api/auth/login', { email: 'rudo@zimutofarm.co.zw', password: 'wrong-pass-1' });
  const l2 = await anon.post('/api/auth/login', { email: 'nobody-qa@example.test', password: 'wrong-pass-1' });
  check('login does not enumerate', l1.status === l2.status && l1.text === l2.text, [l1.text, l2.text]);
}

report('round');
await db.end();
process.exit(findings.length);
