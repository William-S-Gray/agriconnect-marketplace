import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Loader2, Smartphone, Shield, AlertCircle } from 'lucide-react';

interface EcoCashModalProps {
  open: boolean;
  onClose: () => void;
  amount: number;
  itemCount: number;
  onSuccess: (orderRef: string) => void;
}

type Step = 'pin' | 'processing' | 'success' | 'error';

function generateOrderRef(): string {
  const prefix = 'AG';
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `${prefix}-${year}-${rand}`;
}

export function EcoCashModal({ open, onClose, amount, itemCount, onSuccess }: EcoCashModalProps) {
  const [step, setStep] = useState<Step>('pin');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [orderRef, setOrderRef] = useState(generateOrderRef);
  const [countdown, setCountdown] = useState(0);

  // Hold onSuccess in a ref so the processing effect does not restart (and
  // re-run the countdown) just because the parent re-rendered with a new
  // inline callback identity.
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);

  // Reset state when modal opens. A fresh reference per checkout — previously
  // orderRef was generated once for the component's lifetime, so every order
  // placed in the same session shared one reference number.
  useEffect(() => {
    if (open) {
      setStep('pin');
      setPin('');
      setError('');
      setOrderRef(generateOrderRef());
    }
  }, [open]);

  // Processing countdown
  useEffect(() => {
    if (step !== 'processing') return;
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Simulate 95% success rate
          if (Math.random() > 0.05) {
            setStep('success');
            onSuccessRef.current(orderRef);
          } else {
            setStep('error');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step, orderRef]);

  const handleSubmitPin = () => {
    if (pin.length !== 4) {
      setError('Please enter your 4-digit EcoCash PIN');
      return;
    }
    setError('');
    setStep('processing');
  };

  const handlePinChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    if (error) setError('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && step !== 'processing') onClose(); }}>
      <DialogContent className="neo-card border-none max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
            <span className="text-2xl">📱</span> EcoCash Payment
          </DialogTitle>
        </DialogHeader>

        {step === 'pin' && (
          <div className="space-y-5">
            {/* Payment summary */}
            <div className="neo-inset rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items ({itemCount})</span>
                <span className="font-mono font-semibold text-foreground">${amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payable to</span>
                <span className="text-foreground font-medium">AgriConnect Escrow</span>
              </div>
              <div className="border-t border-border/50 pt-2 flex justify-between">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-mono font-bold text-accent text-lg">${amount.toFixed(2)}</span>
              </div>
            </div>

            {/* Escrow notice */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground neo-flat rounded-xl p-3">
              <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Your payment is held in escrow and only released to the farmer once you confirm delivery.</span>
            </div>

            {/* PIN input */}
            <div className="space-y-2">
              <Label className="text-foreground font-medium">Enter your 4-digit EcoCash PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                placeholder="••••"
                className="neo-inset border-none text-center text-2xl tracking-[0.5em] font-mono"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitPin()}
              />
              {error && (
                <p className="text-destructive text-xs flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {error}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 neo-flat border-none" onClick={onClose}>
                Cancel
              </Button>
              <Button
                className="flex-1 btn-gold"
                onClick={handleSubmitPin}
                disabled={pin.length !== 4}
              >
                Authorise Payment
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              <Smartphone className="h-3 w-3 inline mr-1" />
              Powered by EcoCash · Econet Wireless Zimbabwe
            </p>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-20 h-20 rounded-full neo-inset flex items-center justify-center mx-auto">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            </div>
            <div>
              <p className="font-heading font-semibold text-foreground">Processing Payment…</p>
              <p className="text-sm text-muted-foreground mt-1">Connecting to EcoCash network</p>
            </div>
            <div className="flex justify-center gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="py-6 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-heading text-lg font-bold text-foreground">Payment Confirmed!</p>
              <p className="text-sm text-muted-foreground mt-1">Your order has been placed successfully.</p>
            </div>
            <div className="neo-inset rounded-xl p-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Reference</span>
                <span className="font-mono font-bold text-foreground">{orderRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-mono font-bold text-accent">${amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="text-green-600 font-medium">Held in Escrow ✓</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The farmer will confirm your order within 24 hours. Funds are released only after you confirm delivery.
            </p>
            <Button className="w-full btn-gold" onClick={onClose}>
              View My Orders
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="py-6 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <div>
              <p className="font-heading text-lg font-bold text-foreground">Payment Failed</p>
              <p className="text-sm text-muted-foreground mt-1">Could not connect to EcoCash. Please try again.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 neo-flat border-none" onClick={onClose}>
                Cancel
              </Button>
              <Button className="flex-1 btn-gold" onClick={() => setStep('pin')}>
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
