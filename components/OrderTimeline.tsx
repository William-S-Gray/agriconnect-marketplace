import { AlertTriangle, Check, XCircle } from 'lucide-react';

/**
 * Progress of an order through the happy path.
 *
 * Payment is taken into escrow at checkout, so "placed" already means paid;
 * the last step is the buyer confirming receipt, which releases the money.
 * Orders that left the happy path (disputed, cancelled, refunded) get a plain
 * statement instead: drawing them as step 1 of 5, as before, made a disputed
 * order look freshly placed.
 */
const STEPS = ['Placed & paid', 'Confirmed', 'In transit', 'Delivered', 'Completed'];
const STEP: Record<string, number> = { PENDING: 0, CONFIRMED: 1, IN_TRANSIT: 2, DELIVERED: 3, COMPLETED: 5 };

const OFF_PATH: Record<string, { text: string; tone: string; icon: typeof XCircle }> = {
  DISPUTED: { text: 'Disputed — an AgriConnect admin is reviewing this order. Payment stays in escrow.', tone: 'bg-destructive/10 text-destructive', icon: AlertTriangle },
  CANCELLED: { text: 'Cancelled — the payment has been refunded.', tone: 'bg-muted text-muted-foreground', icon: XCircle },
  REFUNDED: { text: 'Refunded to the buyer after a dispute.', tone: 'bg-muted text-muted-foreground', icon: XCircle },
};

export function OrderTimeline({ status }: { status: string }) {
  const off = OFF_PATH[status];
  if (off) {
    const Icon = off.icon;
    return (
      <p className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${off.tone}`} role="status">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {off.text}
      </p>
    );
  }

  // Index of the step in progress; every step before it is done.
  const current = STEP[status] ?? 0;

  return (
    <ol className="flex items-center gap-1 w-full" aria-label={`Order progress: ${STEPS[Math.min(current, STEPS.length - 1)]}`}>
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step} className="flex items-center flex-1 last:flex-none" aria-current={active ? 'step' : undefined}>
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-200 ${
                done || active ? 'bg-primary text-primary-foreground' : 'neo-inset text-muted-foreground'
              }`}>
                {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </div>
              <span className={`text-[11px] mt-1 text-center whitespace-nowrap ${active ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 -mt-3.5 rounded-full ${done ? 'bg-primary' : 'bg-border'}`} aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
