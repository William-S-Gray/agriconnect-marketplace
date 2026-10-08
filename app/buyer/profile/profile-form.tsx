'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function BuyerProfileForm({
  initial,
}: {
  initial: { name: string; phone: string; city: string; address: string; ecocash_number: string };
}) {
  const router = useRouter();
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
          phone: form.get('phone'),
          city: form.get('city'),
          address: form.get('address'),
          ecocash_number: form.get('ecocash_number'),
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
    <form onSubmit={onSubmit} className="neo-card p-6 space-y-4" noValidate>
      <Field name="name" label="Full name" defaultValue={initial.name} required />
      <Field name="phone" label="Phone" defaultValue={initial.phone} />
      <Field name="city" label="City" defaultValue={initial.city} />
      <Field name="address" label="Delivery address" defaultValue={initial.address} />
      <Field name="ecocash_number" label="EcoCash number" defaultValue={initial.ecocash_number} />

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
      <Input id={name} name={name} className="neo-inset" {...props} />
    </div>
  );
}
