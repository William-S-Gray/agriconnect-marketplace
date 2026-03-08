import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Users, Package, AlertTriangle, BarChart3, DollarSign, Sprout, TrendingUp, CheckCircle, XCircle, Phone, Eye, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/StatusBadge';
import { OrderTimeline } from '@/components/OrderTimeline';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { mockFarmers, mockOrders, mockListings, mockPriceHistory, mockDisputes } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast';

const revenueData = [
  { month: 'Oct', revenue: 1200, orders: 15 }, { month: 'Nov', revenue: 2100, orders: 28 },
  { month: 'Dec', revenue: 1800, orders: 22 }, { month: 'Jan', revenue: 3200, orders: 41 },
  { month: 'Feb', revenue: 4100, orders: 53 }, { month: 'Mar', revenue: 2800, orders: 35 },
];

const categoryData = [
  { name: 'Vegetables', value: 45, fill: 'hsl(var(--primary))' },
  { name: 'Fruits', value: 20, fill: 'hsl(var(--accent))' },
  { name: 'Grains', value: 18, fill: 'hsl(var(--earth))' },
  { name: 'Legumes', value: 12, fill: 'hsl(var(--fresh))' },
  { name: 'Other', value: 5, fill: 'hsl(var(--muted-foreground))' },
];

const chartConfig = {
  revenue: { label: 'Revenue', color: 'hsl(var(--primary))' },
  orders: { label: 'Orders', color: 'hsl(var(--accent))' },
};

const statusMap: Record<string, 'order-pending' | 'confirmed' | 'in-season' | 'verified' | 'sold-out'> = {
  PENDING: 'order-pending', CONFIRMED: 'confirmed', IN_TRANSIT: 'in-season',
  DELIVERED: 'verified', COMPLETED: 'verified', DISPUTED: 'sold-out', CANCELLED: 'sold-out',
};

const AdminDashboard = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState('overview');
  const [orderFilter, setOrderFilter] = useState('all');
  const [farmerSearch, setFarmerSearch] = useState('');

  const pendingFarmers = mockFarmers.filter(f => f.status === 'PENDING');
  const totalGMV = mockOrders.reduce((s, o) => s + o.total_amount, 0);
  const totalFees = mockOrders.reduce((s, o) => s + o.platform_fee, 0);
  const filteredOrders = orderFilter === 'all' ? mockOrders : mockOrders.filter(o => o.status === orderFilter);

  const filteredFarmers = farmerSearch
    ? mockFarmers.filter(f => f.name.toLowerCase().includes(farmerSearch.toLowerCase()) || f.farm_name.toLowerCase().includes(farmerSearch.toLowerCase()))
    : mockFarmers;

  const handleVerify = (name: string) => toast({ title: 'Farmer Verified', description: `${name} has been verified.` });
  const handleReject = (name: string) => toast({ title: 'Farmer Rejected', description: `${name} has been rejected.`, variant: 'destructive' });

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 neo-flat rounded-none p-4 shrink-0">
        <div className="flex items-center gap-2 mb-8 px-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="font-heading text-lg font-bold">Admin Panel</span>
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
              {n.value === 'farmers' && pendingFarmers.length > 0 && (
                <span className="ml-auto bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs font-bold">{pendingFarmers.length}</span>
              )}
              {n.value === 'disputes' && mockDisputes.filter(d => d.status === 'OPEN').length > 0 && (
                <span className="ml-auto bg-destructive text-destructive-foreground rounded-full px-2 py-0.5 text-xs font-bold">{mockDisputes.filter(d => d.status === 'OPEN').length}</span>
              )}
            </button>
          ))}
        </nav>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">← Back to Site</Link>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {/* Mobile tabs */}
        <div className="md:hidden mb-6 overflow-x-auto">
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
                { label: 'Total GMV', value: `$${totalGMV.toFixed(0)}`, icon: DollarSign, color: 'text-primary' },
                { label: 'Platform Revenue', value: `$${totalFees.toFixed(0)}`, icon: TrendingUp, color: 'text-accent' },
                { label: 'Active Farmers', value: mockFarmers.filter(f=>f.status==='VERIFIED').length, icon: Users, color: 'text-fresh' },
                { label: 'Active Listings', value: mockListings.filter(l=>l.status==='ACTIVE').length, icon: Sprout, color: 'text-primary' },
              ].map((s, i) => (
                <div key={i} className="neo-card p-5">
                  <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
                  <p className="font-mono text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mb-8">
              {pendingFarmers.length > 0 && (
                <div className="neo-card p-5">
                  <h2 className="font-heading font-semibold text-foreground mb-4">⚠️ Pending Farmer Verifications ({pendingFarmers.length})</h2>
                  {pendingFarmers.map(f => (
                    <div key={f.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                      <div>
                        <p className="font-medium text-foreground text-sm">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{f.farm_name} · {f.province}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => handleVerify(f.name)}>
                          <CheckCircle className="h-3 w-3 mr-1" />Verify
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleReject(f.name)}>
                          <XCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {mockDisputes.filter(d => d.status === 'OPEN').length > 0 && (
                <div className="neo-card p-5">
                  <h2 className="font-heading font-semibold text-foreground mb-4">🔥 Open Disputes</h2>
                  {mockDisputes.filter(d => d.status === 'OPEN').map(d => (
                    <div key={d.id} className="py-3 border-b border-border last:border-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-foreground text-sm">{d.reason}</p>
                          <p className="text-xs text-muted-foreground">Raised by {d.raised_by} · Order #{d.order_id.toUpperCase()}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setTab('disputes')}>Review</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="neo-card p-5">
              <h2 className="font-heading font-semibold text-foreground mb-4">Revenue Trend</h2>
              <ChartContainer config={chartConfig} className="h-[250px]">
                <BarChart data={revenueData}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        )}

        {/* FARMERS */}
        {tab === 'farmers' && (
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Farmer Management</h1>
            <div className="relative mb-6 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search farmers..." value={farmerSearch} onChange={e => setFarmerSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="space-y-4">
              {filteredFarmers.map(f => (
                <div key={f.id} className="neo-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xl">👨‍🌾</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-heading font-semibold text-foreground">{f.name}</h3>
                          <StatusBadge type={f.status === 'VERIFIED' ? 'verified' : f.status === 'PENDING' ? 'pending' : 'sold-out'} />
                        </div>
                        <p className="text-sm text-muted-foreground">{f.farm_name}</p>
                        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                          <span>{f.province}, {f.district}</span>
                          <span>{f.farm_size_ha || '—'} ha</span>
                          <span>EcoCash: {f.ecocash_number}</span>
                        </div>
                        <div className="flex gap-4 text-xs mt-2">
                          <span>★ {f.rating} ({f.total_reviews} reviews)</span>
                          <span>${f.total_sales.toLocaleString()} sales</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {f.status === 'PENDING' && (
                        <>
                          <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => handleVerify(f.name)}>
                            <CheckCircle className="h-3 w-3 mr-1" />Verify
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleReject(f.name)}>
                            <XCircle className="h-3 w-3 mr-1" />Reject
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="outline"><Phone className="h-3 w-3 mr-1" />Call</Button>
                      <Link to={`/farmer/${f.id}`}><Button size="sm" variant="outline"><Eye className="h-3 w-3 mr-1" />View</Button></Link>
                    </div>
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
            <div className="flex gap-2 mb-6 overflow-x-auto">
              {['all', 'PENDING', 'CONFIRMED', 'IN_TRANSIT', 'COMPLETED', 'DISPUTED'].map(s => (
                <button key={s} onClick={() => setOrderFilter(s)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${orderFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {s === 'all' ? 'All' : s.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div className="space-y-4">
              {filteredOrders.map(order => (
                <div key={order.id} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">#{order.id.toUpperCase()}</p>
                      <p className="font-heading font-semibold text-foreground">{order.produce_title}</p>
                    </div>
                    <StatusBadge type={statusMap[order.status] || 'pending'} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mb-3">
                    <div><span className="text-muted-foreground">Buyer:</span> {order.buyer_name}</div>
                    <div><span className="text-muted-foreground">Farmer:</span> {order.farmer_name}</div>
                    <div><span className="text-muted-foreground">Qty:</span> <span className="font-mono">{order.quantity}</span></div>
                    <div><span className="text-muted-foreground">Total:</span> <span className="font-mono">${order.total_amount.toFixed(2)}</span></div>
                    <div><span className="text-muted-foreground">Payment:</span> {order.payment_status}</div>
                  </div>
                  <OrderTimeline status={order.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DISPUTES */}
        {tab === 'disputes' && (
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Disputes</h1>
            <div className="space-y-4">
              {mockDisputes.map(d => (
                <div key={d.id} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-heading font-semibold text-foreground">{d.reason}</h3>
                        <span className={`badge-status ${d.status === 'OPEN' ? 'bg-destructive/10 text-destructive' : 'bg-accent/10 text-accent'}`}>
                          {d.status}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">Dispute #{d.id.toUpperCase()} · Order #{d.order_id.toUpperCase()}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{d.created_at}</span>
                  </div>
                  <p className="text-sm text-foreground mb-3">{d.description}</p>
                  <div className="flex gap-4 text-sm text-muted-foreground mb-4">
                    <span>Raised by: <strong className="text-foreground">{d.raised_by}</strong></span>
                    <span>Buyer: {d.buyer_name}</span>
                    <span>Farmer: {d.farmer_name}</span>
                    <span>Amount: ${d.order_amount?.toFixed(2)}</span>
                  </div>
                  {d.status === 'OPEN' || d.status === 'INVESTIGATING' ? (
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => toast({ title: 'Resolved for Buyer' })}>Resolve for Buyer</Button>
                      <Button size="sm" variant="outline" onClick={() => toast({ title: 'Resolved for Farmer' })}>Resolve for Farmer</Button>
                      <Button size="sm" variant="outline">Request More Info</Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Resolution: {d.resolution || 'Closed'}</p>
                  )}
                </div>
              ))}
              {mockDisputes.length === 0 && <p className="text-center text-muted-foreground py-10">No disputes.</p>}
            </div>
          </div>
        )}

        {/* PRICES */}
        {tab === 'prices' && (
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Market Price Management</h1>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="text-left p-3 text-xs font-semibold">Crop</th>
                    <th className="text-left p-3 text-xs font-semibold">Category</th>
                    <th className="text-right p-3 text-xs font-semibold">Avg Price</th>
                    <th className="text-right p-3 text-xs font-semibold">Min</th>
                    <th className="text-right p-3 text-xs font-semibold">Max</th>
                    <th className="text-left p-3 text-xs font-semibold">Province</th>
                    <th className="text-right p-3 text-xs font-semibold">Listings</th>
                    <th className="text-right p-3 text-xs font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {mockPriceHistory.map(p => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="p-3 text-sm font-medium">{p.produce_type}</td>
                      <td className="p-3 text-sm text-muted-foreground">{p.category}</td>
                      <td className="p-3 text-sm text-right font-mono price-display">${p.avg_price.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right font-mono">${p.min_price.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right font-mono">${p.max_price.toFixed(2)}</td>
                      <td className="p-3 text-sm text-muted-foreground">{p.province}</td>
                      <td className="p-3 text-sm text-right">{p.listings_count}</td>
                      <td className="p-3 text-right"><Button size="sm" variant="outline">Edit</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ANALYTICS */}
        {tab === 'analytics' && (
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Analytics</h1>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total GMV', value: `$${totalGMV.toFixed(0)}` },
                { label: 'Total Orders', value: mockOrders.length },
                { label: 'Avg Order Value', value: `$${(totalGMV / mockOrders.length).toFixed(0)}` },
                { label: 'Active Provinces', value: new Set(mockListings.map(l => l.province)).size },
              ].map((s, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-5">
                  <p className="font-mono text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-heading font-semibold text-foreground mb-4">Monthly Revenue</h2>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <LineChart data={revenueData}>
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                  </LineChart>
                </ChartContainer>
              </div>

              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-heading font-semibold text-foreground mb-4">Listings by Category</h2>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}%`}>
                      {categoryData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </div>

              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-heading font-semibold text-foreground mb-4">Top Crops by Sales</h2>
                <div className="space-y-3">
                  {[
                    { crop: 'Tomatoes', sales: 45, revenue: 1240 },
                    { crop: 'Butternuts', sales: 28, revenue: 980 },
                    { crop: 'Maize', sales: 22, revenue: 850 },
                    { crop: 'Spinach', sales: 18, revenue: 420 },
                    { crop: 'Groundnuts', sales: 15, revenue: 680 },
                  ].map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.crop}</p>
                        <p className="text-xs text-muted-foreground">{c.sales} orders</p>
                      </div>
                      <p className="font-mono font-semibold text-primary">${c.revenue}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-heading font-semibold text-foreground mb-4">Orders by Status</h2>
                <div className="space-y-3">
                  {['PENDING', 'CONFIRMED', 'IN_TRANSIT', 'COMPLETED', 'DISPUTED'].map(status => {
                    const count = mockOrders.filter(o => o.status === status).length;
                    const pct = mockOrders.length > 0 ? (count / mockOrders.length * 100) : 0;
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-24">{status.replace('_', ' ')}</span>
                        <div className="flex-1 bg-muted rounded-full h-2"><div className="bg-primary rounded-full h-2" style={{ width: `${pct}%` }} /></div>
                        <span className="text-xs font-mono w-8 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
