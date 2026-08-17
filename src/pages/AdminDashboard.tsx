import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Users, Package, AlertTriangle, BarChart3, DollarSign, Sprout, TrendingUp, CheckCircle2, XCircle, LogOut } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/stores/auth-store';
import { SEED_FARMERS, SEED_ORDERS, SEED_DISPUTES, SEED_LISTINGS, SEED_PRICES, DEMO_STATS } from '@/lib/seed-data';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LazyBarChart } from '@/components/charts/LazyBarChart';
import { recordDataAccess } from '@/lib/session-anomaly';

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  CONFIRMED: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  IN_TRANSIT: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
  COMPLETED: 'text-green-600 bg-green-50 dark:bg-green-900/20',
  DISPUTED: 'text-red-600 bg-red-50 dark:bg-red-900/20',
  VERIFIED: 'text-green-600 bg-green-50 dark:bg-green-900/20',
  INVESTIGATING: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
};

const weeklyOrders = [
  { day: 'Mon', orders: 3, gmv: 45.80 },
  { day: 'Tue', orders: 7, gmv: 122.50 },
  { day: 'Wed', orders: 5, gmv: 88.00 },
  { day: 'Thu', orders: 9, gmv: 203.40 },
  { day: 'Fri', orders: 12, gmv: 315.20 },
  { day: 'Sat', orders: 8, gmv: 176.60 },
  { day: 'Sun', orders: 4, gmv: 68.90 },
];

/** Sensitive record sets exposed per tab, fed to the volume detector. */
const TAB_RECORD_COUNTS: Record<string, () => number> = {
  farmers: () => SEED_FARMERS.length,
  orders: () => SEED_ORDERS.length,
  disputes: () => SEED_DISPUTES.length,
  prices: () => SEED_PRICES.length,
};

function AdminDashboardInner() {
  const [tab, setTab] = useState('overview');
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [farmers, setFarmers] = useState(SEED_FARMERS);

  // Every tab that lists personal or financial records counts toward the
  // session's data-access volume, so rapid bulk browsing is detectable.
  useEffect(() => {
    const count = TAB_RECORD_COUNTS[tab]?.();
    if (count) recordDataAccess(`admin:${tab}`, count);
  }, [tab]);

  const verifyFarmer = (id: string) => {
    setFarmers(prev => prev.map(f => f.id === id ? { ...f, status: 'VERIFIED' as const } : f));
    toast.success('Farmer verified successfully.');
  };

  const suspendFarmer = (id: string) => {
    setFarmers(prev => prev.map(f => f.id === id ? { ...f, status: 'SUSPENDED' as const } : f));
    toast.error('Farmer suspended.');
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const tabs = [
    { icon: BarChart3, label: 'Overview', value: 'overview' },
    { icon: Users, label: 'Farmers', value: 'farmers', badge: farmers.filter(f => f.status === 'PENDING').length },
    { icon: Package, label: 'Orders', value: 'orders' },
    { icon: AlertTriangle, label: 'Disputes', value: 'disputes', badge: SEED_DISPUTES.length },
    { icon: DollarSign, label: 'Prices', value: 'prices' },
    { icon: TrendingUp, label: 'Analytics', value: 'analytics' },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 neo-flat rounded-none p-4 shrink-0">
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-heading text-lg font-bold text-foreground">Admin Panel</span>
          </div>
          <ThemeToggle />
        </div>
        <nav className="space-y-1 flex-1">
          {tabs.map(n => (
            <button key={n.value} onClick={() => setTab(n.value)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${tab === n.value ? 'neo-inset text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
              <n.icon className="h-4 w-4" />
              {n.label}
              {(n.badge ?? 0) > 0 && (
                <span className="ml-auto bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">{n.badge}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="space-y-1">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 block">← Back to Site</Link>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-destructive transition-colors">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {/* Mobile tabs */}
        <div className="md:hidden mb-6">
          <div className="flex items-center justify-between mb-3">
            <ThemeToggle />
            <button onClick={handleLogout} className="text-xs text-muted-foreground flex items-center gap-1"><LogOut className="h-3.5 w-3.5" /> Logout</button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map(t => (
              <button key={t.value} onClick={() => setTab(t.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex items-center gap-1 ${tab === t.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {t.label}
                {(t.badge ?? 0) > 0 && <span className="bg-destructive text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Admin Dashboard</h1>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total GMV', value: `$${DEMO_STATS.totalGMV.toFixed(2)}`, icon: DollarSign, color: 'text-primary' },
                { label: 'Platform Revenue', value: `$${DEMO_STATS.platformRevenue.toFixed(2)}`, icon: TrendingUp, color: 'text-accent' },
                { label: 'Verified Farmers', value: DEMO_STATS.totalFarmers, icon: Users, color: 'text-fresh' },
                { label: 'Active Listings', value: DEMO_STATS.totalListings, icon: Sprout, color: 'text-primary' },
              ].map((s, i) => (
                <div key={i} className="neo-card p-5">
                  <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
                  <p className="font-mono text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {DEMO_STATS.pendingVerifications > 0 && (
              <div className="neo-card p-4 mb-6 border-l-4 border-amber-500 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <p className="font-medium text-foreground text-sm">{DEMO_STATS.pendingVerifications} farmer{DEMO_STATS.pendingVerifications !== 1 ? 's' : ''} awaiting verification</p>
                  <button onClick={() => setTab('farmers')} className="text-xs text-primary hover:underline">Review now →</button>
                </div>
              </div>
            )}

            <div className="neo-card p-6">
              <h3 className="font-heading text-base font-semibold text-foreground mb-4">Weekly Orders &amp; GMV</h3>
              <LazyBarChart
                data={weeklyOrders}
                xKey="day"
                dataKey="orders"
                name="Orders"
                height={200}
                fill="#4f7c3f"
              />
            </div>
          </div>
        )}

        {/* FARMERS */}
        {tab === 'farmers' && (
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Farmer Management</h1>
            <div className="space-y-3">
              {farmers.map(farmer => (
                <div key={farmer.id} className="neo-card p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl neo-inset flex items-center justify-center text-xl shrink-0">🧑‍🌾</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{farmer.name}</p>
                    <p className="text-xs text-muted-foreground">{farmer.farm_name} · {farmer.province} · {farmer.district}</p>
                    <p className="text-xs text-muted-foreground">{farmer.email} · {farmer.phone}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[farmer.status] ?? 'text-muted-foreground bg-muted'}`}>
                      {farmer.status}
                    </span>
                    {farmer.status === 'PENDING' && (
                      <>
                        <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => verifyFarmer(farmer.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Verify
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs border-destructive text-destructive hover:bg-destructive/10" onClick={() => suspendFarmer(farmer.id)}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      </>
                    )}
                    {farmer.status === 'VERIFIED' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs border-destructive text-destructive hover:bg-destructive/10" onClick={() => suspendFarmer(farmer.id)}>
                        Suspend
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ORDERS */}
        {tab === 'orders' && (
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">All Orders</h1>
            <div className="neo-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="neo-inset">
                      <th className="text-left p-4 text-xs font-semibold text-foreground">Order</th>
                      <th className="text-left p-4 text-xs font-semibold text-foreground hidden sm:table-cell">Buyer</th>
                      <th className="text-left p-4 text-xs font-semibold text-foreground hidden md:table-cell">Farmer</th>
                      <th className="text-right p-4 text-xs font-semibold text-foreground">Amount</th>
                      <th className="text-center p-4 text-xs font-semibold text-foreground">Status</th>
                      <th className="text-center p-4 text-xs font-semibold text-foreground hidden sm:table-cell">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SEED_ORDERS.map((order, i) => (
                      <tr key={order.id} className={`border-t border-border/30 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                        <td className="p-4">
                          <p className="text-sm font-medium text-foreground line-clamp-1">{order.produce_title}</p>
                          <p className="text-xs text-muted-foreground">{order.id.toUpperCase()}</p>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground hidden sm:table-cell">{order.buyer_name}</td>
                        <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">{order.farmer_name}</td>
                        <td className="p-4 text-right font-mono font-bold text-foreground">${order.total_amount.toFixed(2)}</td>
                        <td className="p-4 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[order.status]}`}>{order.status}</span>
                        </td>
                        <td className="p-4 text-center hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground">{order.payment_status.replace('_', ' ')}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* DISPUTES */}
        {tab === 'disputes' && (
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Disputes</h1>
            {SEED_DISPUTES.length === 0 ? (
              <div className="neo-card p-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">No open disputes.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {SEED_DISPUTES.map(dispute => (
                  <div key={dispute.id} className="neo-card p-5 border-l-4 border-amber-500">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="font-medium text-foreground">{dispute.reason}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Order {dispute.order_id.toUpperCase()} · ${dispute.order_amount.toFixed(2)}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLOR[dispute.status]}`}>{dispute.status}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{dispute.description}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Buyer: {dispute.buyer_name} · Farmer: {dispute.farmer_name}</span>
                      <span>Raised: {new Date(dispute.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white">Release to Farmer</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs">Refund Buyer</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs">Request Evidence</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PRICES */}
        {tab === 'prices' && (
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Market Price Management</h1>
            <div className="neo-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="neo-inset">
                      <th className="text-left p-4 text-xs font-semibold text-foreground">Crop</th>
                      <th className="text-left p-4 text-xs font-semibold text-foreground">Province</th>
                      <th className="text-right p-4 text-xs font-semibold text-foreground">Avg Price</th>
                      <th className="text-right p-4 text-xs font-semibold text-foreground">Min</th>
                      <th className="text-right p-4 text-xs font-semibold text-foreground">Max</th>
                      <th className="text-right p-4 text-xs font-semibold text-foreground">Listings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SEED_PRICES.map((p, i) => (
                      <tr key={p.id} className={`border-t border-border/30 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                        <td className="p-4 font-medium text-foreground text-sm">{p.produce_type}</td>
                        <td className="p-4 text-sm text-muted-foreground">{p.province}</td>
                        <td className="p-4 text-right font-mono font-bold text-accent">${p.avg_price.toFixed(2)}</td>
                        <td className="p-4 text-right font-mono text-sm text-muted-foreground">${p.min_price.toFixed(2)}</td>
                        <td className="p-4 text-right font-mono text-sm text-muted-foreground">${p.max_price.toFixed(2)}</td>
                        <td className="p-4 text-right text-sm text-muted-foreground">{p.listings_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ANALYTICS */}
        {tab === 'analytics' && (
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Analytics</h1>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total GMV', value: `$${DEMO_STATS.totalGMV.toFixed(2)}` },
                { label: 'Total Orders', value: SEED_ORDERS.length },
                { label: 'Avg Order Value', value: `$${(DEMO_STATS.totalGMV / SEED_ORDERS.length).toFixed(2)}` },
                { label: 'Active Provinces', value: [...new Set(SEED_LISTINGS.map(l => l.province))].length },
              ].map((s, i) => (
                <div key={i} className="neo-card p-5">
                  <p className="font-mono text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="neo-card p-6">
              <h3 className="font-heading text-base font-semibold text-foreground mb-4">Weekly GMV (USD)</h3>
              <LazyBarChart
                data={weeklyOrders}
                xKey="day"
                dataKey="gmv"
                name="GMV"
                height={220}
                currency
                cellColor={(i) => (i === 4 ? '#f5a623' : '#4f7c3f')}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const AdminDashboard = () => (
  <ProtectedRoute role="admin" redirectTo="/admin/login">
    <AdminDashboardInner />
  </ProtectedRoute>
);

export default AdminDashboard;
