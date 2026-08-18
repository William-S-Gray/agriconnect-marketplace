'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const DELIVERY_OPTIONS = ['Pickup at farm', 'Local delivery', 'Negotiable'];

export function NewListingForm({
  provinces, categories, units, defaults,
}: {
  provinces: string[]; categories: string[]; units: string[];
  defaults: { province: string; district: string };
}) {
  const router = useRouter();
  const [category, setCategory] = useState(categories[0] ?? '');
  const [unit, setUnit] = useState(units[0] ?? 'kg');
  const [province, setProvince] = useState(defaults.province || provinces[0] || '');
  const [organic, setOrganic] = useState(false);
  const [delivery, setDelivery] = useState<string[]>(['Pickup at farm']);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors([]);

    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch('/api/farmer/listings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          title: form.get('title'),
          description: form.get('description') || undefined,
          category,
          produce_type: form.get('produce_type'),
          quantity_kg: form.get('quantity_kg'),
          quantity_unit: unit,
          price_per_unit: form.get('price_per_unit'),
          min_order_qty: form.get('min_order_qty') || 1,
          harvest_date: form.get('harvest_date') || undefined,
          available_until: form.get('available_until') || undefined,
          province,
          district: form.get('district') || '',
          is_organic: organic,
          delivery_options: delivery,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const fieldErrors = data.fields
          ? Object.entries(data.fields).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
          : [data.error ?? 'Could not create the listing.'];
        setErrors(fieldErrors);
        return;
      }

      toast.success('Listing published.');
      router.push('/farm/listings');
      router.refresh();
    } catch {
      setErrors(['Could not reach the server.']);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="neo-card p-6 space-y-5 max-w-2xl" noValidate>
      <div>
        <Label htmlFor="title" className="text-foreground">Title</Label>
        <Input id="title" name="title" required placeholder="Roma Tomatoes — Chemical Free" className="neo-inset border-none" />
      </div>

      <div>
        <Label htmlFor="description" className="text-foreground">Description</Label>
        <Textarea id="description" name="description" rows={3} className="neo-inset border-none" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-foreground">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="neo-inset border-none"><SelectValue /></SelectTrigger>
            <SelectContent className="neo-card border-none">
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="produce_type" className="text-foreground">Produce type</Label>
          <Input id="produce_type" name="produce_type" required placeholder="Tomatoes" className="neo-inset border-none" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="quantity_kg" className="text-foreground">Quantity</Label>
          <Input id="quantity_kg" name="quantity_kg" type="number" min="1" step="any" required className="neo-inset border-none" />
        </div>
        <div>
          <Label className="text-foreground">Unit</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="neo-inset border-none"><SelectValue /></SelectTrigger>
            <SelectContent className="neo-card border-none">
              {units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="price_per_unit" className="text-foreground">Price per unit (USD)</Label>
          <Input id="price_per_unit" name="price_per_unit" type="number" min="0" step="0.01" required className="neo-inset border-none" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="min_order_qty" className="text-foreground">Minimum order</Label>
          <Input id="min_order_qty" name="min_order_qty" type="number" min="1" step="any" defaultValue={1} className="neo-inset border-none" />
        </div>
        <div>
          <Label htmlFor="harvest_date" className="text-foreground">Harvest date</Label>
          <Input id="harvest_date" name="harvest_date" type="date" className="neo-inset border-none" />
        </div>
        <div>
          <Label htmlFor="available_until" className="text-foreground">Available until</Label>
          <Input id="available_until" name="available_until" type="date" className="neo-inset border-none" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-foreground">Province</Label>
          <Select value={province} onValueChange={setProvince}>
            <SelectTrigger className="neo-inset border-none"><SelectValue /></SelectTrigger>
            <SelectContent className="neo-card border-none">
              {provinces.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="district" className="text-foreground">District</Label>
          <Input id="district" name="district" defaultValue={defaults.district} className="neo-inset border-none" />
        </div>
      </div>

      <div>
        <Label className="text-foreground mb-2 block">Delivery options</Label>
        <div className="space-y-2">
          {DELIVERY_OPTIONS.map((option) => (
            <div key={option} className="flex items-center gap-2">
              <Checkbox
                id={option}
                checked={delivery.includes(option)}
                onCheckedChange={(v) =>
                  setDelivery((prev) => (v === true ? [...prev, option] : prev.filter((o) => o !== option)))
                }
              />
              <Label htmlFor={option} className="text-sm text-foreground">{option}</Label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="organic" checked={organic} onCheckedChange={(v) => setOrganic(v === true)} />
        <Label htmlFor="organic" className="text-sm text-foreground">Grown without chemicals (organic)</Label>
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="text-destructive text-sm space-y-1">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <Button type="submit" disabled={submitting} className="w-full neo-btn bg-primary text-primary-foreground">
        {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Publishing…</> : 'Publish listing'}
      </Button>
    </form>
  );
}
