import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Leaf, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { passwordPolicy } from '@/lib/password-policy';
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter';

const schema = z.object({
  password: passwordPolicy,
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
});

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors }, watch } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async () => {
    setLoading(true);
    // Simulate API call — replace with supabase.auth.updateUser when Cloud is enabled
    await new Promise(resolve => setTimeout(resolve, 1500));
    setLoading(false);
    setSuccess(true);
    toast.success('Password has been reset successfully!');
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <Link to="/" className="flex items-center gap-2 text-primary mb-8">
          <Leaf className="h-7 w-7" />
          <span className="font-heading text-2xl font-bold text-foreground">AgriConnect</span>
        </Link>
        <div className="w-full max-w-md neo-card p-6 md:p-8 text-center space-y-4">
          <div className="neo-flat w-16 h-16 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Password Reset!</h1>
          <p className="text-sm text-muted-foreground">Your password has been updated. You can now log in with your new password.</p>
          <Link to="/login">
            <Button className="w-full neo-btn bg-primary text-primary-foreground">Go to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link to="/" className="flex items-center gap-2 text-primary mb-8">
        <Leaf className="h-7 w-7" />
        <span className="font-heading text-2xl font-bold text-foreground">AgriConnect</span>
      </Link>

      <div className="w-full max-w-md neo-card p-6 md:p-8 space-y-6">
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground">Set New Password</h1>
          <p className="text-sm text-muted-foreground mt-2">Choose a strong password for your account.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="password" className="text-foreground">New Password</Label>
            <Input id="password" type="password" {...register('password')} className="neo-inset border-none" autoFocus />
            <PasswordStrengthMeter password={watch('password') || ''} />
            {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
          </div>
          <div>
            <Label htmlFor="confirm_password" className="text-foreground">Confirm New Password</Label>
            <Input id="confirm_password" type="password" {...register('confirm_password')} className="neo-inset border-none" />
            {errors.confirm_password && <p className="text-destructive text-xs mt-1">{errors.confirm_password.message}</p>}
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full neo-btn bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary font-medium hover:underline">Back to Login</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
