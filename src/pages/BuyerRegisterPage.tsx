import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Leaf } from 'lucide-react';
import { passwordPolicy } from '@/lib/password-policy';
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const buyerSchema = z.object({
  name: z.string().min(3),
  phone: z.string().regex(/^(\+263|0)(7[1-8])\d{7}$/, 'Invalid Zimbabwe number'),
  email: z.string().email(),
  city: z.string().min(2),
  buyer_type: z.string().min(1),
  password: passwordPolicy,
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, { message: "Passwords don't match", path: ['confirm_password'] });

type BuyerFormData = z.infer<typeof buyerSchema>;

const BuyerRegisterPage = () => {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<BuyerFormData>({
    resolver: zodResolver(buyerSchema),
  });

  const onSubmit = () => {
    toast.success('Account created!');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="flex items-center gap-2 text-primary mb-8">
        <Leaf className="h-7 w-7" />
        <span className="font-heading text-2xl font-bold text-foreground">AgriConnect</span>
      </Link>
      <div className="w-full max-w-md neo-card p-6 md:p-8 space-y-5">
        <h1 className="font-heading text-2xl font-bold text-foreground text-center">Create Buyer Account</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label className="text-foreground">Full Name *</Label>
            <Input {...register('name')} placeholder="Kudakwashe Moyo" className="neo-inset border-none" />
            {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-foreground">Phone *</Label>
              <Input {...register('phone')} placeholder="0771000000" className="neo-inset border-none" />
              {errors.phone && <p className="text-destructive text-xs mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <Label className="text-foreground">Email *</Label>
              <Input type="email" {...register('email')} placeholder="kuda@email.co.zw" className="neo-inset border-none" />
              {errors.email && <p className="text-destructive text-xs mt-1">{errors.email.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-foreground">City *</Label>
              <Input {...register('city')} placeholder="Harare" className="neo-inset border-none" />
              {errors.city && <p className="text-destructive text-xs mt-1">{errors.city.message}</p>}
            </div>
            <div>
              <Label className="text-foreground">Account Type *</Label>
              <Select onValueChange={v => setValue('buyer_type', v)}>
                <SelectTrigger className="neo-inset border-none"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent className="neo-card border-none">
                  <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                  <SelectItem value="RESTAURANT">Restaurant</SelectItem>
                  <SelectItem value="RETAILER">Retailer</SelectItem>
                  <SelectItem value="PROCESSOR">Processor</SelectItem>
                  <SelectItem value="EXPORTER">Exporter</SelectItem>
                </SelectContent>
              </Select>
              {errors.buyer_type && <p className="text-destructive text-xs mt-1">{errors.buyer_type.message}</p>}
            </div>
          </div>
          <div>
            <Label className="text-foreground">Password *</Label>
            <Input type="password" {...register('password')} className="neo-inset border-none" />
            <PasswordStrengthMeter password={watch('password') || ''} />
            {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
          </div>
          <div>
            <Label className="text-foreground">Confirm Password *</Label>
            <Input type="password" {...register('confirm_password')} className="neo-inset border-none" />
            {errors.confirm_password && <p className="text-destructive text-xs mt-1">{errors.confirm_password.message}</p>}
          </div>
          <Button type="submit" className="w-full neo-btn bg-primary text-primary-foreground">Create Account</Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
};

export default BuyerRegisterPage;
