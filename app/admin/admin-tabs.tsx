'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Shield, Users, Package, AlertTriangle, BarChart3, DollarSign,
  Sprout, TrendingUp, CheckCircle2, XCircle, LogOut, Loader2,
  ShieldAlert, KeyRound, UserCog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LazyBarChart } from '@/components/charts/LazyBarChart';
import { OrderActions } from '@/components/OrderActions';
import { availableActions, type OrderStatus } from '@/lib/order-lifecycle';
import { useLogout } from '@/hooks/use-session';
import { toast } from 'sonner';

interface Stats {
  gmv: number; revenue: number; users: number; farmers: number;
  verified: number; pending: number; listings: number; orders: number; disputes: number;
}
const DISPUTE_STATUS: Record<string, string> = {
  OPEN: 'Open', INVESTIGATING: 'Investigating', RESOLVED_BUYER: 'Resolved for buyer',
  RESOLVED_FARMER: 'Resolved for farmer', CLOSED: 'Closed',
};

interface UserRow {
  id: string; email: string; role: string; status: string; name: string;
}
interface FarmerRow {
  userId: string; name: string; farmName: string; province: string;
  status: string; rating: number; totalSales: number; email: string;
  phone: string; district: string; farmSizeHa: number | null; joined: string; listings: number;
}
interface OrderRow {
  id: string; reference: string; status: string; paymentStatus: string;
  amount: number; createdAt: string; buyerName: string; farmName: string;
}
interface DisputeRow {
  id: string; reason: string; description: string; status: string;
  createdAt: string; reference: string; amount: number;
  orderId: string; orderStatus: string;
}
interface PriceRow {
  id: string; produceType: string; province: string; avgPrice: number; listingsCount: number;
}

/**
 * Admin UI. Every action here calls PATCH /api/admin/users, which independently
 * re-checks the admin role — rendering a button is not what grants the power to
 * use it.
 */
export function AdminTabs({
  email, stats, users, currentUserId, farmers, orders, disputes, prices, weekly,
  securityAlerts,
}: {
  securityAlerts: number;
  users: UserRow[];
  currentUserId: string;
  email: string;
  stats: Stats;
  farmers: FarmerRow[];
  orders: OrderRow[];
  disputes: DisputeRow[];
  prices: PriceRow[];
  weekly: { day: string; orders: number; gmv: number }[];
}) {
  const [tab, setTab] = useState('overview');
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();
  const logout = useLogout();

  const tabs = [
    { icon: BarChart3, label: 'Overview', value: 'overview' },
    { icon: UserCog, label: 'Users', value: 'users' },
    { icon: Users, label: 'Farmers', value: 'farmers', badge: stats.pending },
    { icon: Package, label: 'Orders', value: 'orders' },
    { icon: AlertTriangle, label: 'Disputes', value: 'disputes', badge: stats.disputes },
    { icon: DollarSign, label: 'Prices', value: 'prices' },
    { icon: TrendingUp, label: 'Analytics', value: 'analytics' },
  ];

  async function act(userId: string, action: 'verify_farmer' | 'suspend_farmer' | 'suspend' | 'reactivate') {
    setBusyId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Action failed.');
        return;
      }
      toast.success('Updated.');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function onLogout() {
    await logout();
    router.push('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex flex-col w-64 neo-flat rounded-none p-4 shrink-0">
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-heading text-lg font-bold text-foreground">Admin Panel</span>
          </div>
          <ThemeToggle />
        </div>
        <nav className="space-y-1 flex-1">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                tab === t.value ? 'neo-inset text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {(t.badge ?? 0) > 0 && (
                <span className="ml-auto bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground px-3 truncate">{email}</p>
          <Link href="/settings/security" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 block">
            Security
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 block">
            ← Back to site
          </Link>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="md:hidden flex gap-2 overflow-x-auto pb-3 mb-4">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
                tab === t.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <h1 className="font-heading text-2xl font-bold text-foreground">Admin Dashboard</h1>
              <Link
                href="/admin/security"
                className={`text-sm inline-flex items-center gap-2 px-3 py-2 rounded-xl neo-flat ${
                  securityAlerts > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
                {securityAlerts > 0
                  ? `${securityAlerts} security ${securityAlerts === 1 ? 'anomaly' : 'anomalies'} to review`
                  : 'Session anomalies'}
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Stat icon={DollarSign} label="Total GMV" value={`$${stats.gmv.toFixed(2)}`} />
              <Stat icon={TrendingUp} label="Platform revenue" value={`$${stats.revenue.toFixed(2)}`} />
              <Stat icon={Users} label="Verified farmers" value={String(stats.verified)} />
              <Stat icon={Sprout} label="Active listings" value={String(stats.listings)} />
            </div>

            {stats.pending > 0 && (
              <div className="neo-card p-4 mb-6 border-l-4 border-amber-500 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <p className="font-medium text-foreground text-sm">
                    {stats.pending} farmer{stats.pending !== 1 ? 's' : ''} awaiting verification
                  </p>
                  <button onClick={() => setTab('farmers')} className="text-xs text-primary hover:underline">
                    Review now →
                  </button>
                </div>
              </div>
            )}

            {weekly.length > 0 && (
              <div className="neo-card p-6">
                <h2 className="font-heading text-base font-semibold text-foreground mb-4">Orders by day</h2>
                <LazyBarChart data={weekly} xKey="day" dataKey="orders" name="Orders" height={200} fill="#4f7c3f" />
              </div>
            )}
          </>
        )}

        {tab === 'users' && (
          <>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-2">Users</h1>
            <p className="text-sm text-muted-foreground mb-6 max-w-3xl">
              Setting a password signs that person out everywhere. Pass it on
              privately and ask them to change it under Settings → Security.
            </p>
            <ul className="space-y-3 max-w-3xl">
              {users.map((u) => (
                <UserItem key={u.id} user={u} isSelf={u.id === currentUserId} />
              ))}
            </ul>
          </>
        )}

        {tab === 'farmers' && (
          <>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Farmers</h1>
            <ul className="space-y-3 max-w-3xl">
              {farmers.map((f) => (
                <li key={f.userId} className="neo-card p-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium text-foreground text-sm">{f.farmName}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.name} · {[f.district, f.province].filter(Boolean).join(', ')}
                      {f.farmSizeHa !== null && ` · ${f.farmSizeHa} ha`}
                      {f.status === 'VERIFIED' && ` · ★ ${f.rating.toFixed(1)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {f.email}
                      {f.phone && (
                        <> · <a href={`tel:${f.phone.replace(/\s/g, '')}`} className="text-primary underline underline-offset-2">{f.phone}</a></>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {f.joined} · {f.listings} listing{f.listings === 1 ? '' : 's'} prepared
                    </p>
                  </div>
                  <span className="w-28">
                    <StatusBadge type={f.status === 'VERIFIED' ? 'verified' : f.status === 'SUSPENDED' ? 'suspended' : 'pending'} />
                  </span>
                  <div className="flex gap-2">
                    {f.status !== 'VERIFIED' && (
                      <Button
                        size="sm" disabled={busyId === f.userId}
                        className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => act(f.userId, 'verify_farmer')}
                      >
                        {busyId === f.userId ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                        Verify
                      </Button>
                    )}
                    {f.status !== 'SUSPENDED' && (
                      <Button
                        size="sm" variant="outline" disabled={busyId === f.userId}
                        className="h-7 text-xs border-destructive text-destructive hover:bg-destructive/10"
                        onClick={() => act(f.userId, 'suspend_farmer')}
                      >
                        <XCircle className="h-3 w-3 mr-1" /> Suspend
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === 'orders' && (
          <>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Orders</h1>
            <Table
              head={['Reference', 'Buyer', 'Farm', 'Amount', 'Status', 'Date']}
              rows={orders.map((o) => [
                o.reference, o.buyerName, o.farmName,
                `$${o.amount.toFixed(2)}`, o.status, o.createdAt,
              ])}
            />
          </>
        )}

        {tab === 'disputes' && (
          <>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Disputes</h1>
            {disputes.length === 0 ? (
              <p className="text-muted-foreground">No disputes raised.</p>
            ) : (
              <ul className="space-y-3 max-w-3xl">
                {disputes.map((d) => (
                  <li key={d.id} className="neo-card p-4">
                    <div className="flex justify-between items-start gap-3 flex-wrap">
                      <div>
                        <p className="font-medium text-foreground text-sm">{d.reason}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {d.reference} · ${d.amount.toFixed(2)} · {d.createdAt}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-badge-amber">{DISPUTE_STATUS[d.status] ?? d.status}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{d.description}</p>
                    {/* Resolution is an order transition, so it goes through the
                        same state machine and authorization as every other move. */}
                    <OrderActions
                      orderId={d.orderId}
                      actions={availableActions(d.orderStatus as OrderStatus, 'admin')}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'prices' && (
          <>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Market Prices</h1>
            <Table
              head={['Crop', 'Province', 'Avg price', 'Listings']}
              rows={prices.map((p) => [
                p.produceType, p.province, `$${p.avgPrice.toFixed(2)}`, String(p.listingsCount),
              ])}
            />
          </>
        )}

        {tab === 'analytics' && (
          <>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Analytics</h1>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Stat icon={Users} label="Total users" value={String(stats.users)} />
              <Stat icon={Sprout} label="Farmers" value={String(stats.farmers)} />
              <Stat icon={Package} label="Orders" value={String(stats.orders)} />
              <Stat icon={AlertTriangle} label="Open disputes" value={String(stats.disputes)} />
            </div>
            {weekly.length > 0 && (
              <div className="neo-card p-6">
                <h2 className="font-heading text-base font-semibold text-foreground mb-4">GMV by day (USD)</h2>
                <LazyBarChart
                  data={weekly} xKey="day" dataKey="gmv" name="GMV" height={220} currency
                  cellColors={weekly.map((_, i) => (i === weekly.length - 1 ? '#f5a623' : '#4f7c3f'))}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Stat({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="neo-card p-5">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <p className="tabular-nums text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="neo-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="neo-inset">
              {head.map((h) => (
                <th key={h} className="text-left p-4 text-sm font-semibold text-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={head.length} className="p-12 text-center text-muted-foreground">No records.</td></tr>
            ) : rows.map((row, i) => (
              <tr key={i} className={`border-t border-border/30 ${i % 2 ? 'bg-muted/10' : ''}`}>
                {row.map((cell, j) => (
                  <td key={j} className="p-4 text-sm text-foreground">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A random 20-character password from an unambiguous alphabet. */
function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?';
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % alphabet.length);
  let out = '';
  while (out.length < 20) {
    for (const b of crypto.getRandomValues(new Uint8Array(32))) {
      if (b < limit && out.length < 20) out += alphabet[b % alphabet.length];
    }
  }
  return out;
}

function UserItem({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/users/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ userId: user.id, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data.details ?? [data.error ?? 'Could not set the password.']).join(' '));
        return;
      }
      toast.success(`Password set for ${user.email}. They have been signed out.`);
      setOpen(false);
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="neo-card p-4 space-y-3">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <p className="font-medium text-foreground text-sm">{user.name || user.email}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <span className="text-xs text-muted-foreground w-28 capitalize">
          {user.role} · {user.status.toLowerCase()}
        </span>
        {isSelf ? (
          <Link href="/settings/security" className="text-xs text-primary hover:underline">
            Change yours in Settings
          </Link>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen((o) => !o)}>
            <KeyRound className="h-3 w-3 mr-1" /> Set password
          </Button>
        )}
      </div>
      {open && (
        <div className="flex gap-2 flex-wrap items-center">
          <Input
            aria-label={`New password for ${user.email}`}
            value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="off" spellCheck={false}
            className="neo-inset h-8 text-sm font-mono flex-1 min-w-[220px]"
            placeholder="12+ characters"
          />
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setPassword(generatePassword())}>
            Generate
          </Button>
          <Button size="sm" className="h-8 text-xs bg-primary text-primary-foreground"
            disabled={busy || password.length === 0} onClick={save}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
          </Button>
        </div>
      )}
    </li>
  );
}
