import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Sprout, Package, DollarSign, Settings, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { useFarmerAuth } from '@/stores/auth-store';
import { CATEGORIES, UNITS } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast';

const nav = [
  { icon: BarChart3, label: 'Dashboard', href: '/farm/dashboard' },
  { icon: Sprout, label: 'My Listings', href: '/farm/listings' },
  { icon: Package, label: 'Orders', href: '/farm/orders' },
  { icon: DollarSign, label: 'Earnings', href: '/farm/earnings' },
  { icon: Settings, label: 'Profile', href: '/farm/profile' },
];

const NewListingPage = () => {
  const { farmer, logout } = useFarmerAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: '', category: '', produce_type: '', description: '', is_organic: false,
    quantity: '', unit: 'kg', price: '', min_order: '1', harvest_date: '', available_until: '',
    delivery_pickup: true, delivery_local: false, delivery_negotiable: false,
  });

  if (!farmer) { navigate('/login'); return null; }

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const progress = (step / 3) * 100;

  const handlePublish = () => {
    toast({ title: 'Listing Published!', description: 'Your produce is now visible to buyers.' });
    navigate('/farm/listings');
  };

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar nav={nav} userName={farmer.name} subtitle={farmer.farm_name} status={farmer.status === 'VERIFIED' ? 'verified' : 'pending'} onLogout={logout} />
      <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8 max-w-3xl">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-2">New Listing</h1>
        <Progress value={progress} className="mb-6 h-2" />
        <p className="text-sm text-muted-foreground mb-6">Step {step} of 3</p>

        <div className="neo-card p-6">
          {step === 1 && (
            <div className="space-y-5">
              <div><Label className="text-foreground">Title *</Label><Input placeholder='e.g. "Roma Tomatoes — Chemical Free"' value={form.title} onChange={e => update('title', e.target.value)} className="neo-inset border-none" /></div>
              <div><Label className="text-foreground">Category *</Label>
                <Select value={form.category} onValueChange={v => update('category', v)}>
                  <SelectTrigger className="neo-inset border-none"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent className="neo-card border-none">{CATEGORIES.map(c => <SelectItem key={c.name} value={c.name}>{c.emoji} {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-foreground">Produce Type *</Label><Input placeholder="e.g. Tomatoes, Butternuts" value={form.produce_type} onChange={e => update('produce_type', e.target.value)} className="neo-inset border-none" /></div>
              <div><Label className="text-foreground">Description</Label><Textarea placeholder="Describe your produce (max 500 chars)" maxLength={500} value={form.description} onChange={e => update('description', e.target.value)} className="neo-inset border-none" /></div>
              <div className="flex items-center gap-3">
                <Switch checked={form.is_organic} onCheckedChange={v => update('is_organic', v)} />
                <Label className="text-foreground">Organic produce</Label>
              </div>
              <Button onClick={() => setStep(2)} className="neo-btn bg-primary text-primary-foreground" disabled={!form.title || !form.category || !form.produce_type}>Next: Pricing</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-foreground">Quantity *</Label><Input type="number" value={form.quantity} onChange={e => update('quantity', e.target.value)} className="neo-inset border-none" /></div>
                <div><Label className="text-foreground">Unit *</Label>
                  <Select value={form.unit} onValueChange={v => update('unit', v)}>
                    <SelectTrigger className="neo-inset border-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="neo-card border-none">{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-foreground">Price per Unit (USD) *</Label><Input type="number" step="0.01" value={form.price} onChange={e => update('price', e.target.value)} className="neo-inset border-none" /></div>
                <div><Label className="text-foreground">Min Order Qty *</Label><Input type="number" value={form.min_order} onChange={e => update('min_order', e.target.value)} className="neo-inset border-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-foreground">Harvest Date</Label><Input type="date" value={form.harvest_date} onChange={e => update('harvest_date', e.target.value)} className="neo-inset border-none" /></div>
                <div><Label className="text-foreground">Available Until</Label><Input type="date" value={form.available_until} onChange={e => update('available_until', e.target.value)} className="neo-inset border-none" /></div>
              </div>
              <div>
                <Label className="mb-3 block text-foreground">Delivery Options</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><Checkbox checked={form.delivery_pickup} onCheckedChange={v => update('delivery_pickup', v)} /><span className="text-sm text-foreground">Pickup at farm</span></div>
                  <div className="flex items-center gap-2"><Checkbox checked={form.delivery_local} onCheckedChange={v => update('delivery_local', v)} /><span className="text-sm text-foreground">I can deliver (within district)</span></div>
                  <div className="flex items-center gap-2"><Checkbox checked={form.delivery_negotiable} onCheckedChange={v => update('delivery_negotiable', v)} /><span className="text-sm text-foreground">Delivery negotiable</span></div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="neo-flat border-none">Back</Button>
                <Button onClick={() => setStep(3)} className="neo-btn bg-primary text-primary-foreground" disabled={!form.quantity || !form.price}>Next: Photos</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <Label className="mb-3 block text-foreground">Upload Photos (max 5)</Label>
                <div className="neo-inset rounded-xl p-10 text-center cursor-pointer">
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Drag & drop photos or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP • Max 5 photos</p>
                </div>
              </div>
              <div>
                <Label className="mb-2 block text-foreground">Location</Label>
                <p className="text-sm text-muted-foreground">{farmer.province}, {farmer.district} (from your profile)</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="neo-flat border-none">Back</Button>
                <Button onClick={handlePublish} className="btn-gold">Publish Listing</Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default NewListingPage;
