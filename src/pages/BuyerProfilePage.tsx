import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBuyerAuth } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';

const BuyerProfilePage = () => {
  const { buyer, isAuthenticated } = useBuyerAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  if (!isAuthenticated || !buyer) { navigate('/buyer/login'); return null; }

  const [form, setForm] = useState({
    name: buyer.name, phone: buyer.phone, email: buyer.email,
    city: buyer.city, buyer_type: buyer.buyer_type,
  });

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-6">My Profile</h1>
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div><Label>Full Name</Label><Input value={form.name} onChange={e => update('name', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => update('email', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>City</Label><Input value={form.city} onChange={e => update('city', e.target.value)} /></div>
            <div><Label>Buyer Type</Label>
              <Select value={form.buyer_type} onValueChange={v => update('buyer_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['INDIVIDUAL', 'RESTAURANT', 'RETAILER', 'PROCESSOR', 'EXPORTER'].map(t => (
                    <SelectItem key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={() => toast({ title: 'Profile Updated' })} className="bg-primary text-primary-foreground">
            <Save className="h-4 w-4 mr-1" />Save Changes
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BuyerProfilePage;
