import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Leaf, ArrowLeft, ArrowRight, Upload, Eye, EyeOff, Loader2, CheckCircle2, ImageIcon } from 'lucide-react';
import { passwordPolicy } from '@/lib/password-policy';
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { PROVINCES } from '@/lib/mock-data';
import { toast } from 'sonner';
import { registerDemoFarmer, isEmailTaken } from '@/lib/demo-credentials';

const farmerSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  farm_name: z.string().min(2, 'Farm name required'),
  phone: z.string().regex(/^(\+263|0)(7[1-8])\d{7}$/, 'Invalid Zimbabwe number (e.g. 0771234567)'),
  email: z.string().email('Invalid email address'),
  province: z.string().min(1, 'Select your province'),
  district: z.string().min(2, 'District is required'),
  farm_size_ha: z.string().optional(),
  ecocash_number: z.string().regex(/^(\+263|0)(7[1-8])\d{7}$/, 'Invalid EcoCash number'),
  id_number: z.string().optional(),
  password: passwordPolicy,
  confirm_password: z.string(),
  agreed: z.boolean().refine(v => v, 'You must confirm your details are accurate'),
}).refine(d => d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
});

type FarmerFormData = z.infer<typeof farmerSchema>;

const STEP1_FIELDS: (keyof FarmerFormData)[] = [
  'name', 'farm_name', 'phone', 'email', 'province', 'district', 'ecocash_number',
];

const FarmerRegisterPage = () => {
  const [step, setStep] = useState(1);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const {
    register, handleSubmit, formState: { errors }, setValue, watch, trigger,
  } = useForm<FarmerFormData>({ resolver: zodResolver(farmerSchema) });

  // Validate step 1 fields before advancing
  const handleNextStep = async () => {
    const valid = await trigger(STEP1_FIELDS);
    if (valid) setStep(2);
    else toast.error('Please fix the errors before continuing.');
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: FarmerFormData) => {
    if (isEmailTaken(data.email)) {
      toast.error('An account with that email already exists.');
      return;
    }
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 1200)); // simulate API call
    // Register the account so the user can actually sign in with it afterwards.
    registerDemoFarmer(
      {
        id: crypto.randomUUID(),
        name: data.name,
        farm_name: data.farm_name,
        phone: data.phone,
        email: data.email,
        province: data.province,
        district: data.district,
        farm_size_ha: data.farm_size_ha ? Number(data.farm_size_ha) : undefined,
        profile_photo: photoPreview ?? undefined,
        status: 'PENDING',
        rating: 0,
        total_reviews: 0,
        total_sales: 0,
        ecocash_number: data.ecocash_number,
      },
      data.password,
    );
    toast.success('Registration submitted! Your farm will be verified within 24 hours.');
    setIsSubmitting(false);
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
              <div className={`h-1.5 w-20 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-border'}`} />
              <div className={`h-1.5 w-20 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-border'}`} />
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="neo-card p-6 md:p-8 space-y-5" noValidate>
            {/* ── Step 1 ── */}
            {step === 1 && (
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
                    <Label htmlFor="phone" className="text-foreground">Phone *</Label>
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

                {/* FIX: trigger validation before advancing, not just setStep */}
                <Button type="button" className="w-full neo-btn bg-primary text-primary-foreground" onClick={handleNextStep}>
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            {/* ── Step 2 ── */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="id_number" className="text-foreground">National ID Number (optional)</Label>
                  <Input id="id_number" {...register('id_number')} placeholder="63-123456A78" className="neo-inset border-none" />
                </div>

                {/* Functional photo upload with preview */}
                <div>
                  <Label className="text-foreground">Profile Photo (optional)</Label>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  {photoPreview ? (
                    <div className="neo-inset rounded-xl p-4 flex items-center gap-4">
                      <img src={photoPreview} alt="Preview" className="w-16 h-16 rounded-xl object-cover" />
                      <div>
                        <p className="text-sm font-medium text-foreground flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4 text-green-500" /> Photo selected
                        </p>
                        <button type="button" onClick={() => { setPhotoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-xs text-muted-foreground hover:text-destructive transition-colors mt-1">
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full neo-inset p-8 text-center cursor-pointer rounded-xl hover:opacity-80 transition-opacity">
                      <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload a profile photo</p>
                      <p className="text-xs text-muted-foreground mt-1">JPG, PNG · max 5MB</p>
                    </button>
                  )}
                </div>

                <div>
                  <Label htmlFor="password" className="text-foreground">Password *</Label>
                  <div className="relative">
                    <Input id="password" type={showPw ? 'text' : 'password'} {...register('password')} className="neo-inset border-none pr-10" />
                    <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <PasswordStrengthMeter password={watch('password') || ''} />
                  {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
                </div>

                <div>
                  <Label htmlFor="confirm_password" className="text-foreground">Confirm Password *</Label>
                  <div className="relative">
                    <Input id="confirm_password" type={showConfirm ? 'text' : 'password'} {...register('confirm_password')} className="neo-inset border-none pr-10" />
                    <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirm_password && <p className="text-destructive text-xs mt-1">{errors.confirm_password.message}</p>}
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox onCheckedChange={(v) => setValue('agreed', !!v)} className="mt-0.5" />
                  <span className="text-sm text-foreground">I confirm my farm is real and all information provided is accurate</span>
                </label>
                {errors.agreed && <p className="text-destructive text-xs">{errors.agreed.message}</p>}

                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 neo-flat border-none">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="flex-1 btn-gold">
                    {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registering…</> : 'Register Farm'}
                  </Button>
                </div>
              </div>
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
