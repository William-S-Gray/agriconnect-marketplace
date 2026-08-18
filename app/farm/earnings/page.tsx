import { DollarSign, TrendingUp, Package, Clock } from 'lucide-react';
import { requirePageRole } from '@/lib/page-guard';
import { sql } from '@/lib/db';
import { num } from '@/lib/serialize';
import { FarmShell } from '../farm-shell';
import { LazyBarChart } from '@/components/charts/LazyBarChart';

export const dynamic = 'force-dynamic';

export default async function EarningsPage() {
  const session = await requirePageRole(['farmer'], '/farm/earnings');

  const [profile] = await sql<{ name: string; farm_name: string; status: string }>`
    SELECT name, farm_name, status FROM farmers WHERE user_id = ${session.id}
  `;

  // Aggregated in SQL and scoped to this farmer, so no other farmer's revenue
  // is ever read into the page, not even to be filtered out afterwards.
  const [totals] = await sql<{
    gross: string; payout: string; fees: string; orders: string; pending: string;
  }>`
    SELECT COALESCE(SUM(o.total_amount), 0)  AS gross,
           COALESCE(SUM(o.farmer_payout), 0) AS payout,
           COALESCE(SUM(o.platform_fee), 0)  AS fees,
           COUNT(*)                          AS orders,
           COUNT(*) FILTER (WHERE o.payment_status = 'HELD_ESCROW') AS pending
      FROM orders o JOIN farmers f ON f.id = o.farmer_id
     WHERE f.user_id = ${session.id}
  `;

  const monthly = await sql<{ month: string; payout: string }>`
    SELECT to_char(date_trunc('month', o.created_at), 'Mon') AS month,
           COALESCE(SUM(o.farmer_payout), 0) AS payout
      FROM orders o JOIN farmers f ON f.id = o.farmer_id
     WHERE f.user_id = ${session.id}
     GROUP BY date_trunc('month', o.created_at)
     ORDER BY date_trunc('month', o.created_at)
     LIMIT 12
  `;

  const chartData = monthly.map((m) => ({ month: m.month, payout: num(m.payout) }));

  return (
    <FarmShell name={profile?.name ?? ''} farmName={profile?.farm_name ?? ''} status={profile?.status ?? 'PENDING'}>
      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Earnings</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 max-w-3xl">
        <Stat icon={DollarSign} label="Net payout" value={`$${num(totals?.payout).toFixed(2)}`} />
        <Stat icon={TrendingUp} label="Gross sales" value={`$${num(totals?.gross).toFixed(2)}`} />
        <Stat icon={Package} label="Orders" value={String(totals?.orders ?? 0)} />
        <Stat icon={Clock} label="In escrow" value={String(totals?.pending ?? 0)} />
      </div>

      {chartData.length > 0 && (
        <div className="neo-card p-6 max-w-3xl">
          <h2 className="font-heading text-base font-semibold text-foreground mb-4">Payouts by month</h2>
          <LazyBarChart data={chartData} xKey="month" dataKey="payout" name="Payout" height={220} currency />
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-6 max-w-3xl">
        Platform fees to date: ${num(totals?.fees).toFixed(2)}. Funds held in escrow are
        released once the buyer confirms delivery.
      </p>
    </FarmShell>
  );
}

function Stat({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="neo-card p-5">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <p className="font-mono text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
