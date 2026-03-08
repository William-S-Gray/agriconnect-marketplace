import { Check } from 'lucide-react';

const steps = ['Order Placed', 'Payment Confirmed', 'Farmer Confirmed', 'In Transit', 'Delivered'];
const statusToStep: Record<string, number> = {
  PENDING: 0, CONFIRMED: 2, IN_TRANSIT: 3, DELIVERED: 4, COMPLETED: 4,
};

export function OrderTimeline({ status }: { status: string }) {
  const currentStep = statusToStep[status] ?? 0;

  return (
    <div className="flex items-center gap-1 w-full">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
              i <= currentStep
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground'
            }`}>
              {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className="text-[10px] text-muted-foreground mt-1 text-center whitespace-nowrap">{step}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1 mt-[-14px] ${i < currentStep ? 'bg-primary' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
