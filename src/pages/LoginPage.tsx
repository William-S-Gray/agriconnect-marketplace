import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Leaf, Sprout, ShoppingBag, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, type UserRole } from '@/stores/auth-store';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { isAccountLocked, recordFailedAttempt, resetAttempts } from '@/lib/account-lockout';

const roles = [
  { value: 'farmer' as UserRole, label: 'Farmer', icon: Sprout, hint: 'Demo: john@moyofarm.co.zw', color: 'text-primary' },
  { value: 'buyer' as UserRole, label: 'Buyer', icon: ShoppingBag, hint: 'Any email works', color: 'text-accent' },
  { value: 'admin' as UserRole, label: 'Admin', icon: Shield, hint: 'Demo: admin@agriconnect.co.zw', color: 'text-fresh' },
];

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('buyer');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const { register, handleSubmit, watch } = useForm<{ email: string; password: string }>();
  const emailValue = watch('email');

  // Countdown timer for lockout
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

  const onSubmit = async (data: { email: string; password: string }) => {
    // Check lockout before attempting login
    const lockStatus = isAccountLocked(data.email);
    if (lockStatus.locked) {
      setLockoutSeconds(lockStatus.remainingSeconds);
      toast.error('Account temporarily locked due to too many failed attempts.');
      return;
    }

    const success = await login(data.email, data.password, selectedRole);
    if (success) {
      resetAttempts(data.email);
      toast.success(`Welcome! Logged in as ${selectedRole}.`);
      if (selectedRole === 'farmer') navigate('/farm/dashboard');
      else if (selectedRole === 'buyer') navigate('/buyer/dashboard');
      else if (selectedRole === 'admin') navigate('/admin');
    } else {
      const result = recordFailedAttempt(data.email);
      if (result.locked) {
        setLockoutSeconds(result.lockoutSeconds);
        toast.error('Too many failed attempts. Account locked for 15 minutes.');
      } else {
        toast.error(`Invalid credentials. ${result.attemptsRemaining} attempt${result.attemptsRemaining !== 1 ? 's' : ''} remaining.`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link to="/" className="flex items-center gap-2 text-primary mb-8">
        <Leaf className="h-7 w-7" />
        <span className="font-heading text-2xl font-bold text-foreground">AgriConnect</span>
      </Link>

      <div className="w-full max-w-md neo-card p-6 md:p-8 space-y-6">
        <h1 className="font-heading text-2xl font-bold text-foreground text-center">Sign In</h1>
        <p className="text-center text-sm text-muted-foreground">Choose your role and login to your dashboard</p>

        {/* Role selector */}
        <div className="grid grid-cols-3 gap-3">
          {roles.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => setSelectedRole(r.value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-200 ${
                selectedRole === r.value
                  ? 'neo-inset'
                  : 'neo-flat hover:scale-[1.02]'
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
          {roles.find(r => r.value === selectedRole)?.hint}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-foreground">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              placeholder={selectedRole === 'farmer' ? 'john@moyofarm.co.zw' : selectedRole === 'admin' ? 'admin@agriconnect.co.zw' : 'kuda@email.co.zw'}
              className="neo-inset border-none"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-foreground">Password</Label>
            <Input id="password" type="password" {...register('password')} placeholder="••••••••" className="neo-inset border-none" />
          </div>
          <div className="flex items-center justify-between">
            <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full neo-btn bg-primary text-primary-foreground hover:bg-primary/90">
            Sign In as {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            No account?{' '}
            <Link to="/farmer/register" className="text-primary font-medium hover:underline">Register as Farmer</Link>
            {' · '}
            <Link to="/buyer/register" className="text-primary font-medium hover:underline">Register as Buyer</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
