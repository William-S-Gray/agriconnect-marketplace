import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Users, Package, AlertTriangle, BarChart3, DollarSign, Sprout, TrendingUp } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

const AdminDashboard = () => {
  const [tab, setTab] = useState('overview');

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
          {[
            { icon: BarChart3, label: 'Overview', value: 'overview' },
            { icon: Users, label: 'Farmers', value: 'farmers' },
            { icon: Package, label: 'Orders', value: 'orders' },
            { icon: AlertTriangle, label: 'Disputes', value: 'disputes' },
            { icon: DollarSign, label: 'Prices', value: 'prices' },
            { icon: TrendingUp, label: 'Analytics', value: 'analytics' },
          ].map(n => (
            <button key={n.value} onClick={() => setTab(n.value)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
              tab === n.value ? 'neo-inset text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}>
              <n.icon className="h-4 w-4" />{n.label}
            </button>
          ))}
        </nav>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">← Back to Site</Link>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {/* Mobile tabs */}
        <div className="md:hidden mb-6 overflow-x-auto">
          <div className="flex items-center gap-2 mb-4">
            <ThemeToggle />
          </div>
          <div className="flex gap-2">
            {['overview', 'farmers', 'orders', 'disputes', 'prices', 'analytics'].map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
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
                { label: 'Total GMV', value: '$0', icon: DollarSign, color: 'text-primary' },
                { label: 'Platform Revenue', value: '$0', icon: TrendingUp, color: 'text-accent' },
                { label: 'Active Farmers', value: 0, icon: Users, color: 'text-fresh' },
                { label: 'Active Listings', value: 0, icon: Sprout, color: 'text-primary' },
              ].map((s, i) => (
                <div key={i} className="neo-card p-5">
                  <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
                  <p className="font-mono text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="neo-card p-8 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No activity yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Data will appear here as farmers register and orders are placed.</p>
            </div>
          </div>
        )}

        {/* FARMERS */}
        {tab === 'farmers' && (
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Farmer Management</h1>
            <div className="neo-card p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No farmers registered yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Farmers will appear here once they register.</p>
            </div>
          </div>
        )}

        {/* ORDERS */}
        {tab === 'orders' && (
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">All Orders</h1>
            <div className="neo-card p-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No orders yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Orders will appear here as buyers place them.</p>
            </div>
          </div>
        )}

        {/* DISPUTES */}
        {tab === 'disputes' && (
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Disputes</h1>
            <div className="neo-card p-12 text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No disputes.</p>
              <p className="text-sm text-muted-foreground mt-1">Disputes will appear here when raised by buyers or farmers.</p>
            </div>
          </div>
        )}

        {/* PRICES */}
        {tab === 'prices' && (
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Market Price Management</h1>
            <div className="neo-card p-12 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No price data available.</p>
              <p className="text-sm text-muted-foreground mt-1">Price data will populate as listings are added to the marketplace.</p>
            </div>
          </div>
        )}

        {/* ANALYTICS */}
        {tab === 'analytics' && (
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Analytics</h1>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total GMV', value: '$0' },
                { label: 'Total Orders', value: 0 },
                { label: 'Avg Order Value', value: '$0' },
                { label: 'Active Provinces', value: 0 },
              ].map((s, i) => (
                <div key={i} className="neo-card p-5">
                  <p className="font-mono text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="neo-card p-12 text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No analytics data yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Charts and insights will appear as the platform grows.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
