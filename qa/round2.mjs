// Round 2: account lifecycle, disputes, verified-only selling, money figures.
import { Client, login, enrolMfa, q, db, check, report, findings, PW } from './lib.mjs';
import { generateSync } from 'otplib';

const MP = process.env.MAILPIT_URL ?? 'http://127.0.0.1:18025';
const section = (s) => console.log(`\n── ${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function lastMail(to, subjectRe) {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${MP}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
    const m = list.messages?.find((x) => subjectRe.test(x.Subject));
    if (m) return (await (await fetch(`${MP}/api/v1/message/${m.ID}`)).json()).Text;
    await sleep(300);
  }
  return null;
}
const money = (text, label) => {
  const m = new RegExp(`\\$([0-9.,]+)</p><p[^>]*>${label}`).exec(text.replace(/<!-- -->/g, ''));
  return m ? Number(m[1].replace(/,/g, '')) : null;
};

const anon = new Client('anon');
import { readFileSync } from 'node:fs';
let adminSecret = readFileSync(new URL('./.admin-totp', import.meta.url), 'utf8');
await sleep(31_000); // round 1 just used this step's code
const admin = adminSecret ? await login('admin', 'admin@agriconnect.co.zw', adminSecret) : null;
if (!admin) { console.log('set ADMIN_TOTP (printed by round 1 setup)'); process.exit(99); }

// ─── Verified-only selling ───────────────────────────────────────────────────
section('verified-only selling');
{
  const [l] = await q(`SELECT l.id, f.id AS farmer_id, l.min_order_qty::float AS min FROM listings l JOIN farmers f ON f.id=l.farmer_id JOIN users u ON u.id=f.user_id
                        WHERE u.email='grace@sibandafarm.co.zw' AND l.status='ACTIVE' AND l.quantity_kg > 20 LIMIT 1`);
  const buyer = await login('buyer', 'kuda@email.co.zw');
  await buyer.del('/api/buyer/cart');
  const setup = await buyer.post('/api/buyer/cart', { listingId: l.id, quantity: l.min });
  check('setup: item added while the farm is verified', setup.status === 200, `got ${setup.status}`);
  await q(`UPDATE farmers SET status='PENDING' WHERE id=$1`, [l.farmer_id]);
  const browse = await anon.get('/browse');
  check('unverified farm hidden from browse', !browse.text.includes(l.id), 'listing id present in /browse');
  check('unverified farm listing page 404', (await anon.get(`/listing/${l.id}`)).status === 404, '');
  check('unverified farm profile 404', (await anon.get(`/farmer/${l.farmer_id}`)).status === 404, '');
  const add = await buyer.post('/api/buyer/cart', { listingId: l.id, quantity: l.min });
  check('cannot add an unverified farm to cart', add.status === 409, `got ${add.status}`);
  const pay = await buyer.post('/api/buyer/orders', { deliveryMethod: 'PICKUP' });
  check('checkout refuses an unverified farm already in the cart', pay.status === 409, `got ${pay.status}`);
  await q(`UPDATE farmers SET status='VERIFIED' WHERE id=$1`, [l.farmer_id]);
  await buyer.del('/api/buyer/cart');
}

// ─── Suspension takes effect immediately ─────────────────────────────────────
section('suspension');
{
  const victim = await login('victim', 'blessing@mutasafarm.co.zw');
  const [u] = await q(`SELECT id FROM users WHERE email='blessing@mutasafarm.co.zw'`);
  const s = await admin.patch('/api/admin/users', { userId: u.id, action: 'suspend' });
  check('admin can suspend', s.status === 200, `got ${s.status}`);
  const after = await victim.get('/api/auth/session');
  check('suspended user\'s live session ends', after.json?.authenticated === false, after.text.slice(0, 80));
  const relog = await new Client('x').post('/api/auth/login', { email: 'blessing@mutasafarm.co.zw', password: PW });
  check('suspended user cannot sign in', relog.status === 403, `got ${relog.status}`);
  const selfSuspend = await admin.patch('/api/admin/users', { userId: (await q(`SELECT id FROM users WHERE email='admin@agriconnect.co.zw'`))[0].id, action: 'suspend' });
  check('admin cannot suspend themselves', selfSuspend.status === 400, `got ${selfSuspend.status}`);
  await admin.patch('/api/admin/users', { userId: u.id, action: 'reactivate' });
  const [buyerUser] = await q(`SELECT id FROM users WHERE email='kuda@email.co.zw'`);
  const noFarm = await admin.patch('/api/admin/users', { userId: buyerUser.id, action: 'verify_farmer' });
  check('verify_farmer on a non-farmer is not a silent success', noFarm.status === 404, `got ${noFarm.status}`);
  const ghost = await admin.patch('/api/admin/users', { userId: '00000000-0000-0000-0000-000000000000', action: 'suspend' });
  check('action on a missing user is a 404', ghost.status === 404, `got ${ghost.status}`);
}

// ─── Password reset: single use, ends other sessions, weak password keeps link ─
section('password reset');
{
  const email = 'tafadzwa@dubefarm.co.zw';
  const other = await login('other', email);
  await anon.post('/api/auth/password/forgot', { email });
  const text = await lastMail(email, /Reset/);
  const token = /token=([\w-]+)/.exec(text ?? '')?.[1];
  check('reset email delivered', Boolean(token), text?.slice(0, 80));
  const weak = await anon.post('/api/auth/password/reset', { token, password: 'short' });
  check('weak password rejected', weak.status === 400 && weak.json?.code === 'weak_password', `got ${weak.status}`);
  const ok = await anon.post('/api/auth/password/reset', { token, password: 'a long new passphrase 2026' });
  check('reset works after a weak attempt (link not burned)', ok.status === 200, `got ${ok.status} ${ok.text.slice(0, 80)}`);
  const reuse = await anon.post('/api/auth/password/reset', { token, password: 'another long passphrase 99' });
  check('reset link is single-use', reuse.status === 400, `got ${reuse.status}`);
  const old = await other.get('/api/auth/session');
  check('reset signs out other sessions', old.json?.authenticated === false, old.text.slice(0, 80));
  const oldPw = await new Client('x').post('/api/auth/login', { email, password: PW });
  check('old password stops working', oldPw.status === 401, `got ${oldPw.status}`);
  // restore for later runs
  await q(`UPDATE users SET password_hash=(SELECT password_hash FROM users WHERE email='kuda@email.co.zw') WHERE email=$1`, [email]);
}

// ─── MFA disable needs the password ──────────────────────────────────────────
section('mfa disable');
{
  const c = await login('m', 'rudo@zimutofarm.co.zw');
  await enrolMfa(c);
  const wrong = await c.del('/api/auth/mfa/setup', { password: 'not-my-password' });
  check('MFA disable refuses a wrong password', wrong.status === 401, `got ${wrong.status}`);
  const right = await c.del('/api/auth/mfa/setup', { password: PW });
  check('MFA disable works with the password', right.status === 200, `got ${right.status}`);
  const after = await c.get('/api/auth/session');
  check('MFA disable ends the session', after.json?.authenticated === false, after.text.slice(0, 60));
}

// ─── Disputes: who may do what, and the money follows ────────────────────────
section('disputes');
{
  const buyer = await login('buyer', 'kuda@email.co.zw');
  const farmer = await login('farmer', 'john@moyofarm.co.zw');
  const [l] = await q(`SELECT l.id, l.quantity_kg FROM listings l JOIN farmers f ON f.id=l.farmer_id JOIN users u ON u.id=f.user_id
                        WHERE u.email='john@moyofarm.co.zw' AND l.status='ACTIVE' AND l.quantity_kg >= 10 AND l.quantity_unit='kg' LIMIT 1`);
  await buyer.del('/api/buyer/cart');
  await buyer.post('/api/buyer/cart', { listingId: l.id, quantity: 10 });
  const placed = await buyer.post('/api/buyer/orders', { deliveryMethod: 'PICKUP' });
  const [o] = await q(`SELECT id FROM orders WHERE reference=$1`, [placed.json?.references?.[0] ?? '']);
  for (const a of ['confirm', 'dispatch']) await farmer.patch(`/api/orders/${o.id}`, { action: a });
  const noReason = await buyer.patch(`/api/orders/${o.id}`, { action: 'raise_dispute' });
  check('dispute needs a reason', noReason.status === 400, `got ${noReason.status}`);
  const xss = '<script>alert("dispute")</script>';
  const d = await buyer.patch(`/api/orders/${o.id}`, { action: 'raise_dispute', reason: `Bad ${xss}`, description: xss });
  check('buyer can dispute an order in transit', d.status === 200, `got ${d.status}`);
  check('farmer cannot resolve a dispute', (await farmer.patch(`/api/orders/${o.id}`, { action: 'resolve_release' })).status === 403, '');
  check('buyer cannot resolve a dispute', (await buyer.patch(`/api/orders/${o.id}`, { action: 'resolve_refund' })).status === 403, '');
  const page = await admin.get('/admin');
  check('dispute text is escaped for the admin', !page.text.includes('<script>alert("dispute")</script>'), 'raw script in /admin');
  const [before] = await q(`SELECT quantity_kg FROM listings WHERE id=$1`, [l.id]);
  const refund = await admin.patch(`/api/orders/${o.id}`, { action: 'resolve_refund', resolution: 'Refunded after photos' });
  const [after] = await q(`SELECT quantity_kg FROM listings WHERE id=$1`, [l.id]);
  const [oo] = await q(`SELECT status, payment_status FROM orders WHERE id=$1`, [o.id]);
  const [dd] = await q(`SELECT status FROM disputes WHERE order_id=$1`, [o.id]);
  check('refund resolution: order refunded, stock back, dispute closed',
    refund.status === 200 && oo.status === 'REFUNDED' && oo.payment_status === 'REFUNDED' && Number(after.quantity_kg) - Number(before.quantity_kg) === 10 && dd.status === 'RESOLVED_BUYER',
    { refund: refund.status, oo, dd, before: before.quantity_kg, after: after.quantity_kg });
  const review = await buyer.post(`/api/orders/${o.id}/review`, { rating: 1 });
  check('a refunded order cannot be reviewed', review.status === 409, `got ${review.status}`);
}

// ─── Money figures match the ledger ──────────────────────────────────────────
section('money figures');
{
  const farmer = await login('farmer', 'john@moyofarm.co.zw');
  const [{ released, held }] = await q(`
    SELECT COALESCE(SUM(o.farmer_payout) FILTER (WHERE o.payment_status='RELEASED'),0)::float AS released,
           COALESCE(SUM(o.farmer_payout) FILTER (WHERE o.payment_status='HELD_ESCROW'),0)::float AS held
      FROM orders o JOIN farmers f ON f.id=o.farmer_id JOIN users u ON u.id=f.user_id WHERE u.email='john@moyofarm.co.zw'`);
  const dash = await farmer.get('/farm/dashboard');
  const earn = await farmer.get('/farm/earnings');
  check('dashboard "Paid out to you" equals released payouts', money(dash.text, 'Paid out to you') === released, { shown: money(dash.text, 'Paid out to you'), released });
  check('earnings "Paid out to you" equals released payouts', money(earn.text, 'Paid out to you') === released, { shown: money(earn.text, 'Paid out to you'), released });
  check('earnings "Held in escrow" equals held payouts', money(earn.text, 'Held in escrow') === held, { shown: money(earn.text, 'Held in escrow'), held });
  const buyer = await login('buyer', 'kuda@email.co.zw');
  const [{ spent }] = await q(`SELECT COALESCE(SUM(o.total_amount) FILTER (WHERE o.payment_status <> 'REFUNDED'),0)::float AS spent
                                 FROM orders o JOIN buyers b ON b.id=o.buyer_id JOIN users u ON u.id=b.user_id WHERE u.email='kuda@email.co.zw'`);
  const bd = await buyer.get('/buyer/dashboard');
  check('buyer "Total spent" excludes refunds', money(bd.text, 'Total spent') === spent, { shown: money(bd.text, 'Total spent'), spent });
}

// ─── Abuse limits on the new email endpoints ─────────────────────────────────
section('flood limits');
{
  const statuses = [];
  for (let i = 0; i < 8; i++) statuses.push((await anon.post('/api/auth/verify/resend', { email: 'flood-target@example.test' })).status);
  check('resend cannot flood one inbox', statuses.includes(429), statuses.join(','));
  const reg = [];
  for (let i = 0; i < 8; i++) reg.push((await anon.post('/api/auth/register', { role: 'buyer', email: 'kuda@email.co.zw', password: 'a long passphrase 1234', name: 'Flood Test', phone: '0771234567', city: 'Harare' })).status);
  check('repeated sign-ups for one address are throttled', reg.includes(429), reg.join(','));
  const tokens = [];
  for (let i = 0; i < 20; i++) tokens.push((await anon.post('/api/auth/verify', { token: 'x'.repeat(43) + i })).status);
  check('verification-token guessing is throttled', tokens.includes(429), tokens.join(','));
}

report('round 2');
await db.end();
process.exit(findings.length);
