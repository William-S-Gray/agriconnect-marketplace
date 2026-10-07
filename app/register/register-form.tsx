'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Sprout, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

/**
 * Registration.
 *
 * The role selector only chooses between farmer and buyer. The server's schema
 * refuses anything else, so selecting "admin" is not expressible here and would
 * be rejected server-side even if the request were crafted by hand.
 *
 * Password strength is checked by the server; the errors it returns are shown
 * verbatim rather than re-implemented here, so there is one source of truth.
 */
export function RegisterForm({ initialRole = 'buyer' }: { initialRole?: 'farmer' | 'buyer' }) {
  const router = useRouter();
  const [role, setRole] = useState<'farmer' | 'buyer'>(initialRole);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors([]);

    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {
      role,
      email: form.get('email'),
      password: form.get('password'),
      name: form.get('name'),
      phone: form.get('phone'),
    };
    if (role === 'farmer') {
      payload.farm_name = form.get('farm_name');
      payload.province = form.get('province');
      payload.ecocash_number = form.get('ecocash_number');
    } else {
      payload.city = form.get('city');
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setErrors([`Too many attempts. Try again in ${data.retryAfterSeconds ?? 60}s.`]);
        return;
      }
      if (!res.ok) {
        setErrors(data.details ?? [data.error ?? 'Registration failed.']);
        return;
      }

      // `created: false` means the email was already registered. The server
      // returns the same shape either way so this page cannot be used to
      // discover which emails exist; both paths land on the same message.
      if (!data.created) {
        toast.success('Check your email to continue.');
        router.push('/login');
        return;
      }

      toast.success('Account created.');
      router.push(role === 'farmer' ? '/farm/dashboard' : '/buyer/dashboard');
      router.refresh();
    } catch {
      setErrors(['Could not reach the server. Please try again.']);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md neo-card p-6 md:p-8 space-y-5">
      <h1 className="font-heading text-2xl font-bold text-foreground text-center">
        Create your account
      </h1>

      <div className="grid grid-cols-2 gap-3">
        {([
          { value: 'buyer', label: 'Buyer', icon: ShoppingBag },
          { value: 'farmer', label: 'Farmer', icon: Sprout },
        ] as const).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setRole(option.value)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
              role === option.value ? 'neo-inset' : 'neo-flat hover:scale-[1.02]'
            }`}
          >
            <option.icon className={`h-6 w-6 ${role === option.value ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="text-sm font-medium text-foreground">{option.label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field name="name" label="Full name" autoComplete="name" required />
        <Field name="email" label="Email" type="email" autoComplete="email" required />
        <Field name="phone" label="Phone" placeholder="0771234567" autoComplete="tel" required />

        {role === 'farmer' ? (
          <>
            <Field name="farm_name" label="Farm name" required />
            <Field name="province" label="Province" required />
            <Field name="ecocash_number" label="EcoCash number" placeholder="0771234567" required />
          </>
        ) : (
          <Field name="city" label="City" required />
        )}

        <Field
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 12 characters. A memorable passphrase beats a short complex one."
        />

        {errors.length > 0 && (
          <ul role="alert" className="text-destructive text-sm space-y-1">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="w-full neo-btn bg-primary text-primary-foreground"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating account…</>
          ) : (
            'Create account'
          )}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground text-center">
        Already registered?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
      </p>
    </div>
  );
}

function Field({
  name, label, hint, ...props
}: { name: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <Label htmlFor={name} className="text-foreground">{label}</Label>
      <Input id={name} name={name} className="neo-inset border-none" {...props} />
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
