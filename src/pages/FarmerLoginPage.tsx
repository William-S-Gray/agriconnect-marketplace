import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFarmerAuth } from '@/stores/auth-store';
import { toast } from 'sonner';

const FarmerLoginPage = () => {
  const navigate = useNavigate();
  const { login } = useFarmerAuth();
  const { register, handleSubmit } = useForm<{ email: string; password: string }>();

  const onSubmit = async (data: { email: string; password: string }) => {
    const success = await login(data.email, data.password);
    if (success) {
      toast.success('Welcome back!');
      navigate('/farm/dashboard');
    } else {
      toast.error('Invalid credentials. Try: john@moyofarm.co.zw');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link to="/" className="flex items-center gap-2 text-primary mb-8">
        <Leaf className="h-7 w-7" />
        <span className="font-heading text-2xl font-bold">AgriConnect</span>
      </Link>
      <div className="w-full max-w-sm bg-card border border-border rounded-xl p-6 md:p-8 space-y-5">
        <h1 className="font-heading text-2xl font-bold text-foreground text-center">Farmer Login</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} placeholder="john@moyofarm.co.zw" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register('password')} placeholder="••••••••" />
          </div>
          <Button type="submit" className="w-full bg-primary text-primary-foreground">Login</Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          No account? <Link to="/farmer/register" className="text-primary font-medium hover:underline">Register your farm</Link>
        </p>
      </div>
    </div>
  );
};

export default FarmerLoginPage;
