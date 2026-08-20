import Link from 'next/link';
import { AlertTriangle, ShieldAlert, Activity, ArrowLeft } from 'lucide-react';
import { requirePageRole } from '@/lib/page-guard';
import { sql } from '@/lib/db';
import { iso } from '@/lib/serialize';
import { trustedProxy } from '@/lib/anomaly-monitor';
import { AcknowledgeButton } from './acknowledge-button';

export const dynamic = 'force-dynamic';

/**
 * Security events raised by session anomaly detection.
 *
 * Admin-only, guarded server-side before any markup is produced. Detection that
 * nobody can see is not detection, so this is the surface for it.
 */

const KIND_LABEL: Record<string, string> = {
  impossible_travel: 'Impossible travel',
  data_volume: 'Unusual data access volume',
  privilege_escalation: 'Privilege escalation attempt',
};

const ACTION_LABEL: Record<string, string> = {
  record_only: 'Recorded',
  require_reauth: 'Re-authentication forced',
  revoke_session: 'Session revoked',
};

interface EventRow {
  id: string;
  kind: string;
  severity: 'low' | 'medium' | 'high';
  detail: Record<string, unknown>;
  ip: string | null;
  action_taken: string | null;
  occurrences: number;
  last_seen_at: Date;
  created_at: Date;
  acknowledged_at: Date | null;
  email: string | null;
  role: string | null;
}

export default async function AdminSecurityPage() {
  await requirePageRole(['admin'], '/admin/security');

  const events = await sql<EventRow>`
    SELECT e.id, e.kind::text AS kind, e.severity::text AS severity, e.detail,
           e.ip, e.action_taken, e.occurrences, e.last_seen_at,
           e.created_at, e.acknowledged_at,
           u.email, u.role::text AS role
      FROM security_events e
      LEFT JOIN users u ON u.id = e.user_id
     ORDER BY e.acknowledged_at IS NOT NULL, e.created_at DESC
     LIMIT 200
  `;

  const [counts] = await sql<{ open_high: string; last_24h: string }>`
    SELECT count(*) FILTER (WHERE severity = 'high' AND acknowledged_at IS NULL) AS open_high,
           count(*) FILTER (WHERE created_at > now() - interval '24 hours')      AS last_24h
      FROM security_events
  `;

  // Travel detection is only as good as the edge that reports position, so the
  // page states which detectors are actually live rather than implying three.
  const proxy = trustedProxy();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>

        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary" /> Session anomalies
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Impossible travel, unusual data access volume and privilege escalation
          attempts, detected as requests are served.
        </p>

        {proxy === null ? (
          <div className="neo-inset rounded-xl p-3 mt-4 max-w-2xl border-l-4 border-amber-500">
            <p className="text-sm text-foreground font-medium">
              Travel detection is inactive
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Location comes from CDN headers, and a header is only evidence if
              the edge overwrites whatever the client sent. Set{' '}
              <code className="font-mono">ANOMALY_TRUSTED_PROXY</code> to{' '}
              <code className="font-mono">vercel</code> or{' '}
              <code className="font-mono">cloudflare</code> once deployed behind
              one. Volume and privilege-escalation detection are unaffected.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-2">
            Trusting location headers from{' '}
            <span className="text-foreground font-medium">{proxy}</span>.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 my-6 max-w-md">
          <Stat
            label="Unacknowledged, high severity"
            value={counts?.open_high ?? '0'}
            tone={Number(counts?.open_high ?? 0) > 0 ? 'alert' : 'calm'}
          />
          <Stat label="Raised in the last 24h" value={counts?.last_24h ?? '0'} tone="calm" />
        </div>

        {events.length === 0 ? (
          <div className="neo-inset rounded-2xl p-8 text-center">
            <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-foreground font-medium">No anomalies recorded</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Nothing has tripped a detector.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((e) => (
              <article
                key={e.id}
                className={`neo-flat rounded-2xl p-4 ${e.acknowledged_at ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SeverityBadge severity={e.severity} />
                      <h2 className="font-semibold text-foreground">
                        {KIND_LABEL[e.kind] ?? e.kind}
                      </h2>
                    </div>
                    <p className="text-sm text-foreground mt-1">
                      {String(e.detail.summary ?? '')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {e.email ?? 'unknown account'}
                      {e.role ? ` · ${e.role}` : ''}
                      {e.ip ? ` · ${e.ip}` : ''} · {iso(e.created_at)}
                      {e.occurrences > 1 && (
                        <span className="text-foreground">
                          {' '}· seen {e.occurrences}×, last {iso(e.last_seen_at)}
                        </span>
                      )}
                    </p>
                    {e.action_taken && (
                      <p className="text-xs text-accent mt-1">
                        {ACTION_LABEL[e.action_taken] ?? e.action_taken}
                      </p>
                    )}
                  </div>

                  {!e.acknowledged_at && <AcknowledgeButton eventId={e.id} />}
                </div>

                <Evidence detail={e.detail} />
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'alert' | 'calm' }) {
  return (
    <div className="neo-inset rounded-xl p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-2xl font-bold font-mono ${
          tone === 'alert' ? 'text-destructive' : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: 'low' | 'medium' | 'high' }) {
  const styles = {
    high: 'bg-destructive/15 text-destructive',
    medium: 'bg-accent/15 text-accent',
    low: 'bg-muted text-muted-foreground',
  }[severity];

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles}`}>
      {severity === 'high' && <AlertTriangle className="h-3 w-3 inline mr-1" />}
      {severity}
    </span>
  );
}

/** Evidence, minus the summary already shown above it. */
function Evidence({ detail }: { detail: Record<string, unknown> }) {
  const entries = Object.entries(detail).filter(
    ([key, value]) => key !== 'summary' && value !== null && value !== '',
  );
  if (entries.length === 0) return null;

  return (
    <dl className="mt-3 pt-3 border-t border-border/40 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
            {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
          </dt>
          <dd className="text-sm font-mono text-foreground truncate">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
