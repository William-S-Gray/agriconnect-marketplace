import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Leaf, ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { isRateLimited, getRateLimitRemainingSeconds } from '@/lib/rate-limit';

const schema = z.object({
  email: z.string().trim().email('Please enter a valid email address').max(255),
});

const ForgotPasswordPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors }, getValues } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async () => {
    if (isRateLimited('forgot-password', 3, 60_000)) {
      const remaining = getRateLimitRemainingSeconds('forgot-password');
      toast.error(`Too many attempts. Please wait ${remaining}s before trying again.`);
      return;
    }

    setLoading(true);
    // Simulate API call — replace with real backend call when Cloud is enabled
    await new Promise(resolve => setTimeout(resolve, 1500));
    setLoading(false);
    setSubmitted(true);
    toast.success('If that email exists, a reset link has been sent.');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link to="/" className="flex items-center gap-2 text-primary mb-8">
        <Leaf className="h-7 w-7" />
        <span className="font-heading text-2xl font-bold text-foreground">AgriConnect</span>
      </Link>

      <div className="w-full max-w-md neo-card p-6 md:p-8 space-y-6">
        {submitted ? (
          <div className="text-center space-y-4">
            <div className="neo-flat w-16 h-16 rounded-full flex items-center justify-center mx-auto">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Check Your Email</h1>
            <p className="text-sm text-muted-foreground">
              We've sent a password reset link to <span className="font-medium text-foreground">{getValues('email')}</span>.
              Check your inbox and spam folder.
            </p>
            <p className="text-xs text-muted-foreground">Didn't receive it? Wait a minute, then try again.</p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => setSubmitted(false)} variant="outline" className="neo-flat border-none">
                Try a different email
              </Button>
              <Link to="/login">
                <Button className="w-full neo-btn bg-primary text-primary-foreground">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h1 className="font-heading text-2xl font-bold text-foreground">Forgot Password?</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Enter your email and we'll send you a link to reset your password.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-foreground">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="you@example.co.zw"
                  className="neo-inset border-none"
                  autoFocus
                />
                {errors.email && <p className="text-destructive text-xs mt-1">{errors.email.message}</p>}
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full neo-btn bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Remember your password?{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">Back to Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
