import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Leaf, ArrowLeft, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { isRateLimited, getRateLimitRemainingSeconds } from '@/lib/rate-limit';

const schema = z.object({
  email: z.string().trim().email('Please enter a valid email address').max(255),
  captcha: z.string().min(1, 'Please solve the challenge'),
});

function generateChallenge() {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 15) + 1;
  return { a, b, answer: a + b };
}

const ForgotPasswordPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState(generateChallenge);

  const { register, handleSubmit, formState: { errors }, getValues, setError } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const refreshChallenge = useCallback(() => {
    setChallenge(generateChallenge());
  }, []);

  const onSubmit = async (data: z.infer<typeof schema>) => {
    // Validate CAPTCHA answer
    if (parseInt(data.captcha, 10) !== challenge.answer) {
      setError('captcha', { message: 'Incorrect answer. Try again.' });
      refreshChallenge();
      return;
    }

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
              <Button onClick={() => { setSubmitted(false); refreshChallenge(); }} variant="outline" className="neo-flat border-none">
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

              {/* Math CAPTCHA */}
              <div>
                <Label className="text-foreground">Security Check</Label>
                <div className="flex items-center gap-3 mt-1">
                  <div className="neo-inset px-4 py-2.5 rounded-xl flex items-center gap-2 select-none">
                    <span className="font-heading font-bold text-foreground text-lg">{challenge.a} + {challenge.b} = ?</span>
                  </div>
                  <Input
                    {...register('captcha')}
                    type="number"
                    placeholder="?"
                    className="neo-inset border-none w-20 text-center font-bold"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={refreshChallenge}
                    className="neo-flat p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                    title="New challenge"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
                {errors.captcha && <p className="text-destructive text-xs mt-1">{errors.captcha.message}</p>}
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
