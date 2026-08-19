import { requirePageRole } from '@/lib/page-guard';
import { sql } from '@/lib/db';
import { num, iso } from '@/lib/serialize';
import { AdminTabs } from './admin-tabs';

export const dynamic = 'force-dynamic';

/**
 * Admin dashboard.
 *
 * requirePageRole(['admin']) runs before any markup is generated, so a
 * non-admin never receives this page's contents — not even briefly, the way the
 * old client-side guard did. Every mutating control inside re-authorises
 * through /api/admin/users.
 */
export default async function AdminPage() {
  const session = await requirePageRole(['admin'], '/admin');

  const [stats] = await sql<{
    gmv: string; revenue: string; users: string; farmers: string;
    verified: string; pending: string; listings: string; orders: string; disputes: string;
  }>`
    SELECT COALESCE((SELECT SUM(total_amount) FROM orders), 0)  AS gmv,
           COALESCE((SELECT SUM(platform_fee) FROM orders), 0)  AS revenue,
           (SELECT count(*) FROM users)                          AS users,
           (SELECT count(*) FROM farmers)                        AS farmers,
           (SELECT count(*) FROM farmers WHERE status='VERIFIED') AS verified,
           (SELECT count(*) FROM farmers WHERE status='PENDING')  AS pending,
           (SELECT count(*) FROM listings WHERE status='ACTIVE')  AS listings,
           (SELECT count(*) FROM orders)                          AS orders,
           (SELECT count(*) FROM disputes WHERE status IN ('OPEN','INVESTIGATING')) AS disputes
  `;

  // Explicit column lists: password_hash and mfa_secret are never selected, so
  // they cannot reach the client even by accident.
  const farmers = await sql<{
    user_id: string; name: string; farm_name: string; province: string;
    status: string; rating: string; total_sales: number; email: string;
  }>`
    SELECT f.user_id, f.name, f.farm_name, f.province, f.status, f.rating,
           f.total_sales, u.email
      FROM farmers f JOIN users u ON u.id = f.user_id
     ORDER BY (f.status = 'PENDING') DESC, f.name
  `;

  const orders = await sql<{
    id: string; reference: string; status: string; payment_status: string;
    total_amount: string; created_at: Date; buyer_name: string; farm_name: string;
  }>`
    SELECT o.id, o.reference, o.status, o.payment_status, o.total_amount, o.created_at,
           b.name AS buyer_name, f.farm_name
      FROM orders o
      JOIN buyers  b ON b.id = o.buyer_id
      JOIN farmers f ON f.id = o.farmer_id
     ORDER BY o.created_at DESC LIMIT 50
  `;

  const disputes = await sql<{
    id: string; reason: string; description: string; status: string;
    created_at: Date; reference: string; amount: string;
    order_id: string; order_status: string;
  }>`
    SELECT d.id, d.reason, d.description, d.status, d.created_at,
           o.id AS order_id, o.status AS order_status,
           o.reference, o.total_amount AS amount
      FROM disputes d JOIN orders o ON o.id = d.order_id
     ORDER BY d.created_at DESC
  `;

  const prices = await sql<{
    id: string; produce_type: string; province: string; avg_price: string; listings_count: number;
  }>`
    SELECT id, produce_type, province, avg_price, listings_count
      FROM price_history ORDER BY produce_type LIMIT 50
  `;

  const weekly = await sql<{ day: string; orders: string; gmv: string }>`
    SELECT to_char(created_at, 'Dy')            AS day,
           count(*)                             AS orders,
           COALESCE(SUM(total_amount), 0)       AS gmv
      FROM orders
     GROUP BY to_char(created_at, 'Dy'), date_part('dow', created_at)
     ORDER BY date_part('dow', created_at)
  `;

  return (
    <AdminTabs
      email={session.email}
      stats={{
        gmv: num(stats?.gmv), revenue: num(stats?.revenue),
        users: Number(stats?.users ?? 0), farmers: Number(stats?.farmers ?? 0),
        verified: Number(stats?.verified ?? 0), pending: Number(stats?.pending ?? 0),
        listings: Number(stats?.listings ?? 0), orders: Number(stats?.orders ?? 0),
        disputes: Number(stats?.disputes ?? 0),
      }}
      farmers={farmers.map((f) => ({
        userId: f.user_id, name: f.name, farmName: f.farm_name, province: f.province,
        status: f.status, rating: num(f.rating), totalSales: f.total_sales, email: f.email,
      }))}
      orders={orders.map((o) => ({
        id: o.id, reference: o.reference, status: o.status, paymentStatus: o.payment_status,
        amount: num(o.total_amount), createdAt: iso(o.created_at).slice(0, 10),
        buyerName: o.buyer_name, farmName: o.farm_name,
      }))}
      disputes={disputes.map((d) => ({
        id: d.id, reason: d.reason, description: d.description, status: d.status,
        createdAt: iso(d.created_at).slice(0, 10), reference: d.reference, amount: num(d.amount),
        orderId: d.order_id, orderStatus: d.order_status,
      }))}
      prices={prices.map((p) => ({
        id: p.id, produceType: p.produce_type, province: p.province,
        avgPrice: num(p.avg_price), listingsCount: p.listings_count,
      }))}
      weekly={weekly.map((w) => ({ day: w.day, orders: Number(w.orders), gmv: num(w.gmv) }))}
    />
  );
}
