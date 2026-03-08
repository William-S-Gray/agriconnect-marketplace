import { useNavigate } from 'react-router-dom';
import { BarChart3, Sprout, Package, DollarSign, Settings, TrendingUp, ArrowUpRight, Wallet } from 'lucide-react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { useFarmerAuth } from '@/stores/auth-store';
import { getOrdersByFarmer } from '@/lib/mock-data';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis } from 'recharts';

const nav = [
  { icon: BarChart3, label: 'Dashboard', href: '/farm/dashboard' },
  { icon: Sprout, label: 'My Listings', href: '/farm/listings' },
  { icon: Package, label: 'Orders', href: '/farm/orders' },
  { icon: DollarSign, label: 'Earnings', href: '/farm/earnings' },
  { icon: Settings, label: 'Profile', href: '/farm/profile' },
];

const chartData = [
  { month: 'Oct', earnings: 420 }, { month: 'Nov', earnings: 680 },
  { month: 'Dec', earnings: 350 }, { month: 'Jan', earnings: 890 },
  { month: 'Feb', earnings: 1100 }, { month: 'Mar', earnings: 760 },
];

const chartConfig = { earnings: { label: 'Earnings', color: 'hsl(var(--primary))' } };

const EarningsPage = () => {
  const { farmer, logout } = useFarmerAuth();
  const navigate = useNavigate();

  if (!farmer) { navigate('/login'); return null; }

  const orders = getOrdersByFarmer(farmer.id);
  const completedOrders = orders.filter(o => o.status === 'COMPLETED');
  const totalEarnings = completedOrders.reduce((s, o) => s + o.farmer_payout, 0);
  const totalFees = completedOrders.reduce((s, o) => s + o.platform_fee, 0);
  const pendingPayout = orders.filter(o => o.payment_status === 'HELD_ESCROW').reduce((s, o) => s + o.farmer_payout, 0);

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar nav={nav} userName={farmer.name} subtitle={farmer.farm_name} status={farmer.status === 'VERIFIED' ? 'verified' : 'pending'} onLogout={logout} />
      <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Earnings</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: DollarSign, label: 'Total Earnings', value: `$${totalEarnings.toFixed(2)}`, color: 'text-primary' },
            { icon: Wallet, label: 'Pending Payout', value: `$${pendingPayout.toFixed(2)}`, color: 'text-accent' },
            { icon: TrendingUp, label: 'Platform Fees', value: `$${totalFees.toFixed(2)}`, color: 'text-muted-foreground' },
          ].map((s, i) => (
            <div key={i} className="neo-card p-5">
              <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
              <p className="font-mono text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="neo-card p-5 mb-8">
          <h2 className="font-heading font-semibold text-foreground mb-4">Earnings Trend</h2>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <BarChart data={chartData}>
              <XAxis dataKey="month" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        <div className="neo-card p-5">
          <h2 className="font-heading font-semibold text-foreground mb-4">Payout History</h2>
          <div className="space-y-3">
            {completedOrders.map(o => (
              <div key={o.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{o.produce_title}</p>
                  <p className="text-xs text-muted-foreground">{o.created_at}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-semibold text-primary flex items-center gap-1"><ArrowUpRight className="h-3 w-3" />${o.farmer_payout.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Fee: ${o.platform_fee.toFixed(2)}</p>
                </div>
              </div>
            ))}
            {completedOrders.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No completed payouts yet.</p>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default EarningsPage;
