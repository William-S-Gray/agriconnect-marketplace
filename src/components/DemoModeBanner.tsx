import { useState } from 'react';
import { Sprout, X } from 'lucide-react';
import { DEMO_PASSWORD } from '@/lib/demo-credentials';

export function DemoModeBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative z-50 bg-amber-500/90 text-amber-950 text-xs md:text-sm py-2 px-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Sprout className="h-4 w-4 shrink-0" />
        <span className="font-medium truncate">
          🌱 Demo Mode — Sample data only. No real payments are processed.
          <span className="hidden sm:inline">
            {' '}Farmer: <strong>john@moyofarm.co.zw</strong> | Buyer: <strong>kuda@email.co.zw</strong> | Password: <strong>{DEMO_PASSWORD}</strong>
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* The admin entry point is deliberately not linked here — App.tsx treats
            /admin/login as unlisted, and a public link contradicted that. */}
        <button
          onClick={() => setDismissed(true)}
          className="hover:opacity-70 transition-opacity"
          aria-label="Dismiss demo banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
