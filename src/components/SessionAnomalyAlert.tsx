import { useEffect, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { subscribeToAnomalies, getAnomalyLog, type Anomaly } from '@/lib/session-anomaly';

/**
 * Real-time surface for session anomaly detection. Subscribes once at the app
 * root and renders the most recent finding, so a detection is visible to the
 * user the moment it happens rather than only in a log.
 */
export function SessionAnomalyAlert() {
  // Seeded from the log because the most important detection — a tampered
  // session caught while the auth store rehydrates — fires before React has
  // mounted anything, so a subscribe-only component would always miss it.
  const [anomaly, setAnomaly] = useState<Anomaly | null>(
    () => getAnomalyLog().at(-1) ?? null,
  );

  useEffect(() => subscribeToAnomalies(setAnomaly), []);

  if (!anomaly) return null;

  const critical = anomaly.severity === 'critical';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`relative z-50 px-4 py-2 text-xs md:text-sm flex items-center justify-between gap-3 ${
        critical ? 'bg-destructive text-destructive-foreground' : 'bg-amber-500/90 text-amber-950'
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span className="font-medium truncate">
          {anomaly.message}
          {anomaly.detail && (
            <span className="hidden sm:inline font-normal opacity-80"> ({anomaly.detail})</span>
          )}
        </span>
      </div>
      <button
        onClick={() => setAnomaly(null)}
        className="hover:opacity-70 transition-opacity shrink-0"
        aria-label="Dismiss security alert"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
