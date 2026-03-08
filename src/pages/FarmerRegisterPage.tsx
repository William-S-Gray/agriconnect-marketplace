import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Leaf, ArrowLeft, ArrowRight, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { PROVINCES } from '@/lib/mock-data';
import { toast } from 'sonner';

const farmerSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  farm_name: z.string().min(2, 'Farm name required'),
  phone: z.string().regex(/^(\+263|0)(7[1-8])\d{7}$/, 'Invalid Zimbabwe number'),
  email: z.string().email('Invalid email'),
  province: z.string().min(1, 'Select a province'),
  district: z.string().min(2, 'District required'),
  farm_size_ha: z.string().optional(),
  ecocash_number: z.string().regex(/^(\+263|0)(7[1-8])\d{7}$/, 'Invalid EcoCash number'),
  id_number: z.string().optional(),
  password: z.string().min(8, 'Minimum 8 characters'),
  confirm_password: z.string(),
  agreed: z.boolean().refine(v => v, 'You must agree'),
}).refine(d => d.password === d.confirm_password, { message: "Passwords don't match", path: ['confirm_password'] });

type FarmerFormData = z.infer<typeof farmerSchema>;

const FarmerRegisterPage = () => {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, setValue } = useForm<FarmerFormData>({
    resolver: zodResolver(farmerSchema),
  });

  const onSubmit = (data: FarmerFormData) => {
    toast.success('Registration submitted! Your farm will be verified within 24 hours.');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container mx-auto px-4 py-6">
        <Link to="/" className="flex items-center gap-2 text-primary">
          <Leaf className="h-6 w-6" />
          <span className="font-heading text-xl font-bold text-foreground">AgriConnect</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="font-heading text-3xl font-bold text-foreground">Register Your Farm</h1>
            <p className="text-muted-foreground mt-2">Step {step} of 2</p>
            <div className="flex gap-2 mt-4 justify-center">
              <div className={`h-1.5 w-20 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-border'}`} />
              <div className={`h-1.5 w-20 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-border'}`} />
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="neo-card p-6 md:p-8 space-y-5">
            {step === 1 && (
              <>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-foreground">Full Name *</Label>
                    <Input id="name" {...register('name')} placeholder="John Moyo" className="neo-inset border-none" />
                    {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="farm_name" className="text-foreground">Farm Name *</Label>
                    <Input id="farm_name" {...register('farm_name')} placeholder="Moyo's Green Acres" className="neo-inset border-none" />
                    {errors.farm_name && <p className="text-destructive text-xs mt-1">{errors.farm_name.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone" className="text-foreground">Phone Number *</Label>
                      <Input id="phone" {...register('phone')} placeholder="0771234567" className="neo-inset border-none" />
                      {errors.phone && <p className="text-destructive text-xs mt-1">{errors.phone.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-foreground">Email *</Label>
                      <Input id="email" type="email" {...register('email')} placeholder="john@farm.co.zw" className="neo-inset border-none" />
                      {errors.email && <p className="text-destructive text-xs mt-1">{errors.email.message}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-foreground">Province *</Label>
                      <Select onValueChange={(v) => setValue('province', v)}>
                        <SelectTrigger className="neo-inset border-none"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent className="neo-card border-none">
                          {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {errors.province && <p className="text-destructive text-xs mt-1">{errors.province.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="district" className="text-foreground">District *</Label>
                      <Input id="district" {...register('district')} placeholder="Marondera" className="neo-inset border-none" />
                      {errors.district && <p className="text-destructive text-xs mt-1">{errors.district.message}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="farm_size_ha" className="text-foreground">Farm Size (ha)</Label>
                      <Input id="farm_size_ha" type="number" {...register('farm_size_ha')} placeholder="10" className="neo-inset border-none" />
                    </div>
                    <div>
                      <Label htmlFor="ecocash_number" className="text-foreground">EcoCash Number *</Label>
                      <Input id="ecocash_number" {...register('ecocash_number')} placeholder="0771234567" className="neo-inset border-none" />
                      {errors.ecocash_number && <p className="text-destructive text-xs mt-1">{errors.ecocash_number.message}</p>}
                    </div>
                  </div>
                </div>
                <Button type="button" className="w-full neo-btn bg-primary text-primary-foreground" onClick={() => setStep(2)}>
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="id_number" className="text-foreground">National ID Number (optional)</Label>
                    <Input id="id_number" {...register('id_number')} placeholder="63-123456A78" className="neo-inset border-none" />
                  </div>
                  <div>
                    <Label className="text-foreground">Profile Photo (optional)</Label>
                    <div className="neo-inset p-8 text-center cursor-pointer rounded-xl">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Drag & drop or click to upload</p>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="password" className="text-foreground">Password *</Label>
                    <Input id="password" type="password" {...register('password')} className="neo-inset border-none" />
                    {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="confirm_password" className="text-foreground">Confirm Password *</Label>
                    <Input id="confirm_password" type="password" {...register('confirm_password')} className="neo-inset border-none" />
                    {errors.confirm_password && <p className="text-destructive text-xs mt-1">{errors.confirm_password.message}</p>}
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <Checkbox onCheckedChange={(v) => setValue('agreed', !!v)} className="mt-0.5" />
                    <span className="text-sm text-foreground">I confirm my farm is real and all information provided is accurate</span>
                  </label>
                  {errors.agreed && <p className="text-destructive text-xs">{errors.agreed.message}</p>}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 neo-flat border-none">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button type="submit" className="flex-1 btn-gold">Register Farm</Button>
                </div>
              </>
            )}

            <p className="text-center text-sm text-muted-foreground">
              Already registered? <Link to="/login" className="text-primary font-medium hover:underline">Login here</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FarmerRegisterPage;
