import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/stores/auth-store';
import { toast } from 'sonner';
import { isAccountLocked, recordFailedAttempt, resetAttempts } from '@/lib/account-lockout';
import { DEMO_PASSWORD, DEMO_ADMIN_EMAIL } from '@/lib/demo-credentials';

const schema = z.object({
  email: z.string().min(1, 'Required').email('Invalid email'),
  password: z.string().min(1, 'Required'),
});
type Form = z.infer<typeof schema>;

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const onSubmit = async (data: Form) => {
    // Admin is the highest-value target here, so it gets the same lockout the
    // public login has — previously it had none at all.
    const lockStatus = isAccountLocked(data.email);
    if (lockStatus.locked) {
      setLockoutSeconds(lockStatus.remainingSeconds);
      toast.error('Too many failed attempts. Try again later.');
      return;
    }

    setSubmitting(true);
    try {
      const ok = await login(data.email, data.password, 'admin');
      if (ok) {
        resetAttempts(data.email);
        toast.success('Admin access granted.');
        navigate('/admin');
      } else {
        const result = recordFailedAttempt(data.email);
        if (result.locked) {
          setLockoutSeconds(result.lockoutSeconds);
          toast.error('Too many failed attempts. Locked for 15 minutes.');
        } else {
          // Deliberately vague — do not reveal whether the email is a valid admin.
          toast.error('Access denied. Invalid admin credentials.');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm neo-card p-8 space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl neo-inset flex items-center justify-center mx-auto mb-4">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Admin Access</h1>
          <p className="text-xs text-muted-foreground mt-1">This page is not publicly listed.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label className="text-foreground">Admin Email *</Label>
            <Input {...register('email')} type="email" placeholder="admin@agriconnect.co.zw" className="neo-inset border-none" />
            {errors.email && <p className="text-destructive text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Label className="text-foreground">Password *</Label>
            <div className="relative">
              <Input {...register('password')} type={showPw ? 'text' : 'password'} placeholder="••••••••" className="neo-inset border-none pr-10" />
              <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
          </div>
          {lockoutSeconds > 0 && (
            <div className="neo-inset rounded-xl p-3 text-destructive text-xs text-center">
              Locked. Try again in{' '}
              <strong>{Math.floor(lockoutSeconds / 60)}:{String(lockoutSeconds % 60).padStart(2, '0')}</strong>
            </div>
          )}
          <Button type="submit" disabled={submitting || lockoutSeconds > 0} className="w-full neo-btn bg-primary text-primary-foreground">
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying…</> : 'Access Admin Panel'}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center">
          Demo: {DEMO_ADMIN_EMAIL} / <code className="font-mono">{DEMO_PASSWORD}</code>
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;
