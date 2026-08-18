/**
 * Seeds the database from the original demo fixtures.
 *
 * The point of this script is that the demo survives the move to real auth: the
 * same 8 farmers, 3 buyers and admin account still sign in with the documented
 * demo password, but now against Argon2id hashes in Postgres rather than a
 * string comparison in the browser bundle.
 *
 * Fixture ids ("farmer-001") are mapped to generated UUIDs, so foreign keys are
 * real database references.
 *
 * Run with:  npm run db:seed
 * Idempotent: re-running updates existing rows rather than duplicating them.
 */
import { hash } from '@node-rs/argon2';
import { sql, pool } from '../lib/pool';
import { randomUUID } from 'node:crypto';
import {
  SEED_FARMERS,
  SEED_BUYERS,
  SEED_LISTINGS,
  SEED_ORDERS,
  SEED_DISPUTES,
  SEED_PRICES,
  SEED_REVIEWS,
} from '../lib/seed-data';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to .env.local.');
  process.exit(1);
}

/**
 * The shared demo password. Documented publicly on purpose — these are demo
 * accounts. It must satisfy lib/password.ts's policy (>= 12 chars, not a common
 * password), which the old 'Demo@1234' did not.
 */
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'AgriDemo!2026';
const ADMIN_EMAIL = 'admin@agriconnect.co.zw';


const ARGON2 = {
  // Algorithm.Argon2id. Written as a literal because @node-rs/argon2 declares
  // it as an ambient const enum, which isolatedModules cannot read.
  algorithm: 2 as const,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

// fixture id -> uuid
const farmerIds = new Map<string, string>();
const buyerIds = new Map<string, string>();
const listingIds = new Map<string, string>();
const orderIds = new Map<string, string>();

async function upsertUser(
  email: string,
  role: 'farmer' | 'buyer' | 'admin',
  passwordHash: string,
): Promise<string> {
  const rows = (await sql`
    INSERT INTO users (email, password_hash, role, email_verified_at)
    VALUES (${email.toLowerCase()}, ${passwordHash}, ${role}::user_role, now())
    ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          role          = EXCLUDED.role,
          updated_at    = now()
    RETURNING id
  `) as { id: string }[];
  return rows[0]!.id;
}

async function main() {
  console.log('Hashing demo password with Argon2id...');
  const passwordHash = await hash(DEMO_PASSWORD, ARGON2);

  // ─── Admin ──────────────────────────────────────────────────────────────────
  await upsertUser(ADMIN_EMAIL, 'admin', passwordHash);
  console.log(`  admin: ${ADMIN_EMAIL}`);

  // ─── Farmers ────────────────────────────────────────────────────────────────
  for (const f of SEED_FARMERS) {
    const userId = await upsertUser(f.email, 'farmer', passwordHash);
    const id = farmerIds.get(f.id) ?? randomUUID();
    farmerIds.set(f.id, id);

    await sql`
      INSERT INTO farmers
        (id, user_id, name, farm_name, phone, province, district, gps_lat, gps_lng,
         farm_size_ha, profile_photo, status, rating, total_reviews, total_sales, ecocash_number)
      VALUES
        (${id}, ${userId}, ${f.name}, ${f.farm_name}, ${f.phone}, ${f.province},
         ${f.district}, ${f.gps_lat ?? null}, ${f.gps_lng ?? null}, ${f.farm_size_ha ?? null},
         ${f.profile_photo ?? null}, ${f.status}::farmer_status, ${f.rating},
         ${f.total_reviews}, ${f.total_sales}, ${f.ecocash_number})
      ON CONFLICT (user_id) DO UPDATE
        SET name = EXCLUDED.name, farm_name = EXCLUDED.farm_name,
            status = EXCLUDED.status, rating = EXCLUDED.rating,
            total_reviews = EXCLUDED.total_reviews, total_sales = EXCLUDED.total_sales,
            updated_at = now()
      RETURNING id
    `;
    // Re-read in case the row already existed with a different uuid.
    const existing = (await sql`
      SELECT id FROM farmers WHERE user_id = ${userId} LIMIT 1
    `) as { id: string }[];
    farmerIds.set(f.id, existing[0]!.id);
  }
  console.log(`  farmers: ${SEED_FARMERS.length}`);

  // ─── Buyers ─────────────────────────────────────────────────────────────────
  for (const b of SEED_BUYERS) {
    const userId = await upsertUser(b.email, 'buyer', passwordHash);
    const id = randomUUID();

    await sql`
      INSERT INTO buyers (id, user_id, name, phone, buyer_type, city, address, ecocash_number)
      VALUES (${id}, ${userId}, ${b.name}, ${b.phone}, ${b.buyer_type}::buyer_type,
              ${b.city}, ${b.address ?? null}, ${b.ecocash_number ?? null})
      ON CONFLICT (user_id) DO UPDATE
        SET name = EXCLUDED.name, city = EXCLUDED.city, updated_at = now()
    `;
    const existing = (await sql`
      SELECT id FROM buyers WHERE user_id = ${userId} LIMIT 1
    `) as { id: string }[];
    buyerIds.set(b.id, existing[0]!.id);
  }
  console.log(`  buyers: ${SEED_BUYERS.length}`);

  // ─── Listings ───────────────────────────────────────────────────────────────
  for (const l of SEED_LISTINGS) {
    const farmerId = farmerIds.get(l.farmer_id);
    if (!farmerId) {
      console.warn(`  skipping listing ${l.id}: unknown farmer ${l.farmer_id}`);
      continue;
    }
    const id = randomUUID();
    const rows = (await sql`
      INSERT INTO listings
        (id, farmer_id, title, description, category, produce_type, quantity_kg,
         quantity_unit, price_per_unit, currency, min_order_qty, harvest_date,
         available_from, available_until, photos, is_organic, is_available,
         province, district, delivery_options, views_count, status, created_at)
      VALUES
        (${id}, ${farmerId}, ${l.title}, ${l.description ?? null}, ${l.category},
         ${l.produce_type}, ${l.quantity_kg}, ${l.quantity_unit}, ${l.price_per_unit},
         ${l.currency}, ${l.min_order_qty}, ${l.harvest_date ?? null},
         ${l.available_from}, ${l.available_until ?? null},
         ${l.photos as unknown as string[]}, ${l.is_organic}, ${l.is_available},
         ${l.province}, ${l.district}, ${l.delivery_options as unknown as string[]},
         ${l.views_count}, ${l.status}::listing_status, ${l.created_at})
      RETURNING id
    `) as { id: string }[];
    listingIds.set(l.id, rows[0]!.id);
  }
  console.log(`  listings: ${listingIds.size}`);

  // ─── Orders ─────────────────────────────────────────────────────────────────
  for (const o of SEED_ORDERS) {
    const buyerId = buyerIds.get(o.buyer_id);
    const farmerId = farmerIds.get(o.farmer_id);
    const listingId = listingIds.get(o.listing_id);
    if (!buyerId || !farmerId || !listingId) {
      console.warn(`  skipping order ${o.id}: unresolved reference`);
      continue;
    }
    const id = randomUUID();
    const rows = (await sql`
      INSERT INTO orders
        (id, reference, buyer_id, farmer_id, listing_id, quantity, unit_price,
         total_amount, platform_fee, farmer_payout, currency, delivery_method,
         delivery_address, delivery_date, status, payment_status, buyer_confirmed,
         notes, created_at)
      VALUES
        (${id}, ${o.id.toUpperCase()}, ${buyerId}, ${farmerId}, ${listingId},
         ${o.quantity}, ${o.unit_price}, ${o.total_amount}, ${o.platform_fee},
         ${o.farmer_payout}, ${o.currency}, ${o.delivery_method}::delivery_method,
         ${o.delivery_address ?? null}, ${o.delivery_date ?? null},
         ${o.status}::order_status, ${o.payment_status}::payment_status,
         ${o.buyer_confirmed}, ${o.notes ?? null}, ${o.created_at})
      ON CONFLICT (reference) DO NOTHING
      RETURNING id
    `) as { id: string }[];
    if (rows[0]) orderIds.set(o.id, rows[0].id);
  }
  console.log(`  orders: ${orderIds.size}`);

  // ─── Disputes ───────────────────────────────────────────────────────────────
  let disputeCount = 0;
  for (const d of SEED_DISPUTES) {
    const orderId = orderIds.get(d.order_id);
    if (!orderId) continue;
    await sql`
      INSERT INTO disputes (order_id, raised_by, reason, description, status, resolution, created_at)
      VALUES (${orderId}, ${d.raised_by}::dispute_party, ${d.reason}, ${d.description},
              ${d.status}::dispute_status, ${d.resolution ?? null}, ${d.created_at})
    `;
    disputeCount++;
  }
  console.log(`  disputes: ${disputeCount}`);

  // ─── Reviews ────────────────────────────────────────────────────────────────
  let reviewCount = 0;
  for (const r of SEED_REVIEWS) {
    const orderId = orderIds.get(r.order_id);
    const farmerId = farmerIds.get(r.farmer_id);
    const buyerId = buyerIds.get(r.buyer_id);
    if (!orderId || !farmerId || !buyerId) continue;
    await sql`
      INSERT INTO reviews (order_id, farmer_id, buyer_id, rating, comment, created_at)
      VALUES (${orderId}, ${farmerId}, ${buyerId}, ${r.rating}, ${r.comment}, ${r.created_at})
      ON CONFLICT (order_id) DO NOTHING
    `;
    reviewCount++;
  }
  console.log(`  reviews: ${reviewCount}`);

  // ─── Price history ──────────────────────────────────────────────────────────
  await sql`DELETE FROM price_history`;
  for (const p of SEED_PRICES) {
    await sql`
      INSERT INTO price_history
        (produce_type, category, province, avg_price, min_price, max_price, listings_count, recorded_at)
      VALUES (${p.produce_type}, ${p.category}, ${p.province}, ${p.avg_price},
              ${p.min_price}, ${p.max_price}, ${p.listings_count}, ${p.recorded_at})
    `;
  }
  console.log(`  prices: ${SEED_PRICES.length}`);

  console.log('\nSeed complete.');
  console.log(`Demo password for every seeded account: ${DEMO_PASSWORD}`);
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    await pool.end().catch(() => {});
  // Log the message only. A full error object from the driver can include the
  // connection string, which must never reach logs.
    console.error('Seed failed:', err instanceof Error ? err.message : 'unknown error');
    process.exit(1);
  });
