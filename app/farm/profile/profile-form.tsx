'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

/**
 * Farmer profile editing.
 *
 * Posts to PATCH /api/me, which strips privileged fields and targets the row by
 * session user id. Verification status and rating are shown but not editable —
 * they are not in the form and would be rejected server-side anyway.
 */
export function ProfileForm({
  provinces, initial,
}: {
  provinces: string[];
  initial: {
    name: string; farm_name: string; phone: string;
    province: string; district: string; ecocash_number: string;
  };
}) {
  const router = useRouter();
  const [province, setProvince] = useState(initial.province);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);

    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: form.get('name'),
          farm_name: form.get('farm_name'),
          phone: form.get('phone'),
          province,
          district: form.get('district'),
          ecocash_number: form.get('ecocash_number'),
          // Only checked server-side when the payout number actually changes.
          current_password: form.get('current_password') || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Could not save your profile.');
        return;
      }
      toast.success('Profile updated.');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="neo-card p-6 space-y-4 max-w-xl" noValidate>
      <Field name="name" label="Your name" defaultValue={initial.name} required />
      <Field name="farm_name" label="Farm name" defaultValue={initial.farm_name} required />
      <Field name="phone" label="Phone" defaultValue={initial.phone} />
      <div>
        <Label className="text-foreground">Province</Label>
        <Select value={province} onValueChange={setProvince}>
          <SelectTrigger className="neo-inset border-none" aria-label="Province"><SelectValue>{province}</SelectValue></SelectTrigger>
          <SelectContent className="neo-card border-none">
            {provinces.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Field name="district" label="District" defaultValue={initial.district} />
      <Field name="ecocash_number" label="EcoCash number (payouts)" defaultValue={initial.ecocash_number} />
      <Field
        name="current_password" type="password" autoComplete="current-password"
        label="Current password (required to change your EcoCash number)"
      />

      <Button type="submit" disabled={submitting} className="w-full neo-btn bg-primary text-primary-foreground">
        {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : 'Save changes'}
      </Button>
    </form>
  );
}

function Field({
  name, label, ...props
}: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <Label htmlFor={name} className="text-foreground">{label}</Label>
      <Input id={name} name={name} className="neo-inset border-none" {...props} />
    </div>
  );
}
