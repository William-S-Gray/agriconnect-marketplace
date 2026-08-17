import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { BarChart3, Sprout, Package, DollarSign, Settings, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { useFarmerAuth } from '@/stores/auth-store';
import { PROVINCES } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast';

const nav = [
  { icon: BarChart3, label: 'Dashboard', href: '/farm/dashboard' },
  { icon: Sprout, label: 'My Listings', href: '/farm/listings' },
  { icon: Package, label: 'Orders', href: '/farm/orders' },
  { icon: DollarSign, label: 'Earnings', href: '/farm/earnings' },
  { icon: Settings, label: 'Profile', href: '/farm/profile' },
];

const FarmerProfileEditPage = () => {
  const { farmer, logout } = useFarmerAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: farmer?.name || '', farm_name: farmer?.farm_name || '', phone: farmer?.phone || '',
    email: farmer?.email || '', province: farmer?.province || '', district: farmer?.district || '',
    ecocash_number: farmer?.ecocash_number || '', farm_size_ha: farmer?.farm_size_ha?.toString() || '',
  });

  if (!farmer) return <Navigate to="/login" replace />;

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar nav={nav} userName={farmer.name} subtitle={farmer.farm_name} status={farmer.status === 'VERIFIED' ? 'verified' : 'pending'} onLogout={logout} />
      <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8 max-w-2xl">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Edit Profile</h1>
        <div className="neo-card p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div><Label className="text-foreground">Full Name</Label><Input value={form.name} onChange={e => update('name', e.target.value)} className="neo-inset border-none" /></div>
            <div><Label className="text-foreground">Farm Name</Label><Input value={form.farm_name} onChange={e => update('farm_name', e.target.value)} className="neo-inset border-none" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label className="text-foreground">Phone</Label><Input value={form.phone} onChange={e => update('phone', e.target.value)} className="neo-inset border-none" /></div>
            <div><Label className="text-foreground">Email</Label><Input value={form.email} onChange={e => update('email', e.target.value)} className="neo-inset border-none" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label className="text-foreground">Province</Label>
              <Select value={form.province} onValueChange={v => update('province', v)}>
                <SelectTrigger className="neo-inset border-none"><SelectValue /></SelectTrigger>
                <SelectContent className="neo-card border-none">{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-foreground">District</Label><Input value={form.district} onChange={e => update('district', e.target.value)} className="neo-inset border-none" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label className="text-foreground">EcoCash Number</Label><Input value={form.ecocash_number} onChange={e => update('ecocash_number', e.target.value)} className="neo-inset border-none" /></div>
            <div><Label className="text-foreground">Farm Size (ha)</Label><Input type="number" value={form.farm_size_ha} onChange={e => update('farm_size_ha', e.target.value)} className="neo-inset border-none" /></div>
          </div>
          <Button onClick={() => toast({ title: 'Profile Updated', description: 'Your changes have been saved.' })} className="neo-btn bg-primary text-primary-foreground">
            <Save className="h-4 w-4 mr-1" />Save Changes
          </Button>
        </div>
      </main>
    </div>
  );
};

export default FarmerProfileEditPage;
