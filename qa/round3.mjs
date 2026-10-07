// Round 3: races and flows that only show up under timing or across accounts.
import { Client, login, q, db, check, report, findings, PW } from './lib.mjs';

const MP = process.env.MAILPIT_URL ?? 'http://127.0.0.1:18025';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const section = (s) => console.log(`\n── ${s}`);
async function lastMail(to, subjectRe) {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${MP}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
    const m = list.messages?.find((x) => subjectRe.test(x.Subject));
    if (m) return (await (await fetch(`${MP}/api/v1/message/${m.ID}`)).json()).Text;
    await sleep(300);
  }
  return null;
}

// ─── Double-submitted checkout ───────────────────────────────────────────────
section('double checkout');
{
  const buyer = await login('buyer', 'procurement@hararefresh.co.zw');
  const [l] = await q(`SELECT l.id, l.min_order_qty::float AS min FROM listings l JOIN farmers f ON f.id=l.farmer_id
                        WHERE l.status='ACTIVE' AND f.status='VERIFIED' AND l.quantity_kg >= 100 AND l.quantity_unit='kg' LIMIT 1`);
  for (let attempt = 0; attempt < 5; attempt++) {
    await buyer.del('/api/buyer/cart');
    await buyer.post('/api/buyer/cart', { listingId: l.id, quantity: l.min });
    const [{ n: before }] = await q(`SELECT count(*)::int n FROM orders o JOIN buyers b ON b.id=o.buyer_id JOIN users u ON u.id=b.user_id WHERE u.email='procurement@hararefresh.co.zw'`);
    const rs = await Promise.all([1, 2, 3].map(() => buyer.post('/api/buyer/orders', { deliveryMethod: 'PICKUP' })));
    const [{ n: after }] = await q(`SELECT count(*)::int n FROM orders o JOIN buyers b ON b.id=o.buyer_id JOIN users u ON u.id=b.user_id WHERE u.email='procurement@hararefresh.co.zw'`);
    if (!check(`one cart, triple-submitted, makes one order (try ${attempt + 1})`, after - before === 1, { created: after - before, statuses: rs.map((r) => r.status) })) break;
  }
}

// ─── Pre-registration takeover via the confirmation link ─────────────────────
section('pre-registration');
{
  const victim = `victim-${Date.now()}@example.test`;
  const attacker = new Client('attacker');
  await attacker.post('/api/auth/register', { role: 'buyer', email: victim, password: 'attacker knows this one', name: 'Not The Victim', phone: '0771234567', city: 'Harare' });
  const text = await lastMail(victim, /Confirm/);
  const token = /token=([\w-]+)/.exec(text ?? '')?.[1];
  // The victim, who never signed up, opens the link and presses confirm.
  const victimBrowser = new Client('victim');
  const confirm = await victimBrowser.post('/api/auth/verify', { token });
  check('confirming needs the password chosen at sign-up', confirm.status !== 200,
    `victim confirmed and was signed into an account whose password the attacker set (status ${confirm.status})`);
}

// ─── Out-of-stock listings are not advertised ────────────────────────────────
section('stock visibility');
{
  const [l] = await q(`SELECT l.id, l.quantity_kg FROM listings l JOIN farmers f ON f.id=l.farmer_id WHERE l.status='ACTIVE' AND f.status='VERIFIED' LIMIT 1`);
  await q(`UPDATE listings SET quantity_kg=0 WHERE id=$1`, [l.id]);
  const browse = await new Client('a').get('/browse');
  check('a listing with no stock is not shown as buyable', !browse.text.includes(l.id), 'zero-stock listing in /browse');
  await q(`UPDATE listings SET quantity_kg=$2 WHERE id=$1`, [l.id, l.quantity_kg]);
}

report('round 3');
await db.end();
process.exit(findings.length);
