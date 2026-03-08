import { useNavigate } from 'react-router-dom';
import { BarChart3, Sprout, Package, DollarSign, Settings, Wallet, TrendingUp } from 'lucide-react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { useFarmerAuth } from '@/stores/auth-store';

const nav = [
  { icon: BarChart3, label: 'Dashboard', href: '/farm/dashboard' },
  { icon: Sprout, label: 'My Listings', href: '/farm/listings' },
  { icon: Package, label: 'Orders', href: '/farm/orders' },
  { icon: DollarSign, label: 'Earnings', href: '/farm/earnings' },
  { icon: Settings, label: 'Profile', href: '/farm/profile' },
];

const EarningsPage = () => {
  const { farmer, logout } = useFarmerAuth();
  const navigate = useNavigate();

  if (!farmer) { navigate('/login'); return null; }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar nav={nav} userName={farmer.name} subtitle={farmer.farm_name} status={farmer.status === 'VERIFIED' ? 'verified' : 'pending'} onLogout={logout} />
      <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Earnings</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: DollarSign, label: 'Total Earnings', value: '$0.00', color: 'text-primary' },
            { icon: Wallet, label: 'Pending Payout', value: '$0.00', color: 'text-accent' },
            { icon: TrendingUp, label: 'Platform Fees', value: '$0.00', color: 'text-muted-foreground' },
          ].map((s, i) => (
            <div key={i} className="neo-card p-5">
              <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
              <p className="font-mono text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="neo-card p-8 text-center">
          <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">No earnings yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Complete orders to start earning.</p>
        </div>
      </main>
    </div>
  );
};

export default EarningsPage;
