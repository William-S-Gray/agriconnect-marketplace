import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Leaf, Sprout, ShoppingBag, AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, type UserRole } from '@/stores/auth-store';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { isAccountLocked, recordFailedAttempt, resetAttempts } from '@/lib/account-lockout';
import { DEMO_PASSWORD } from '@/lib/demo-credentials';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

// Admin is removed from public login — use /admin/login
const roles = [
  { value: 'farmer' as UserRole, label: 'Farmer', icon: Sprout, hint: `john@moyofarm.co.zw / ${DEMO_PASSWORD}`, color: 'text-primary' },
  { value: 'buyer' as UserRole, label: 'Buyer', icon: ShoppingBag, hint: `kuda@email.co.zw / ${DEMO_PASSWORD}`, color: 'text-accent' },
];

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('buyer');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const onSubmit = async (data: LoginForm) => {
    const lockStatus = isAccountLocked(data.email);
    if (lockStatus.locked) {
      setLockoutSeconds(lockStatus.remainingSeconds);
      toast.error('Account temporarily locked.');
      return;
    }
    setIsSubmitting(true);
    try {
      const success = await login(data.email, data.password, selectedRole);
      if (success) {
        resetAttempts(data.email);
        toast.success(`Welcome back! Signed in as ${selectedRole}.`);
        if (selectedRole === 'farmer') navigate('/farm/dashboard');
        else navigate('/buyer/dashboard');
      } else {
        const result = recordFailedAttempt(data.email);
        if (result.locked) {
          setLockoutSeconds(result.lockoutSeconds);
          toast.error('Too many failed attempts. Account locked for 15 minutes.');
        } else {
          toast.error(`Invalid credentials. ${result.attemptsRemaining} attempt${result.attemptsRemaining !== 1 ? 's' : ''} remaining.`);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link to="/" className="flex items-center gap-2 mb-8">
        <Leaf className="h-7 w-7 text-primary" />
        <span className="font-heading text-2xl font-bold text-foreground">AgriConnect</span>
      </Link>

      <div className="w-full max-w-md neo-card p-6 md:p-8 space-y-6">
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground">Sign In</h1>
          <p className="text-sm text-muted-foreground mt-1">Choose your role to continue</p>
        </div>

        {/* Role selector — Admin removed from public page */}
        <div className="grid grid-cols-2 gap-3">
          {roles.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => setSelectedRole(r.value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-200 ${
                selectedRole === r.value ? 'neo-inset' : 'neo-flat hover:scale-[1.02]'
              }`}
            >
              <r.icon className={`h-6 w-6 ${selectedRole === r.value ? r.color : 'text-muted-foreground'}`} />
              <span className={`text-sm font-medium ${selectedRole === r.value ? 'text-foreground' : 'text-muted-foreground'}`}>
                {r.label}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-center text-muted-foreground">
          Demo: <strong>{roles.find(r => r.value === selectedRole)?.hint}</strong>
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email" className="text-foreground">Email *</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              placeholder={selectedRole === 'farmer' ? 'john@moyofarm.co.zw' : 'kuda@email.co.zw'}
              className="neo-inset border-none"
              autoComplete="email"
            />
            {errors.email && <p className="text-destructive text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <Label htmlFor="password" className="text-foreground">Password *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                placeholder="••••••••"
                className="neo-inset border-none pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary hover:underline">
              Forgot password?
            </Link>
          </div>

          {lockoutSeconds > 0 && (
            <div className="neo-inset rounded-xl p-3 flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="text-xs">
                Account locked. Try again in{' '}
                <strong>{Math.floor(lockoutSeconds / 60)}:{String(lockoutSeconds % 60).padStart(2, '0')}</strong>
              </p>
            </div>
          )}

          <Button
            type="submit"
            disabled={lockoutSeconds > 0 || isSubmitting}
            className="w-full neo-btn bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…</>
            ) : (
              `Sign In as ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}`
            )}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground text-center">
          No account?{' '}
          <Link to="/farmer/register" className="text-primary font-medium hover:underline">Register as Farmer</Link>
          {' · '}
          <Link to="/buyer/register" className="text-primary font-medium hover:underline">Register as Buyer</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
