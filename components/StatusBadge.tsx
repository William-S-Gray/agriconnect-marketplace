import { CheckCircle, Clock, AlertTriangle, XCircle, Truck, Package, Leaf } from 'lucide-react';

type BadgeType = 'verified' | 'pending' | 'suspended' | 'in-season' | 'limited' | 'sold-out' | 'organic' |
  'order-pending' | 'confirmed' | 'in-transit' | 'delivered' | 'completed' | 'disputed' | 'cancelled' | 'refunded';

const config: Record<BadgeType, { label: string; className: string; icon?: React.ElementType }> = {
  'verified':      { label: 'Verified',     className: 'badge-verified',  icon: CheckCircle },
  'pending':       { label: 'Pending',      className: 'badge-pending',   icon: Clock },
  'suspended':     { label: 'Suspended',    className: 'badge-sold-out',  icon: XCircle },
  'in-season':     { label: 'In Season',    className: 'badge-in-season', icon: CheckCircle },
  'limited':       { label: 'Limited',      className: 'badge-limited',   icon: AlertTriangle },
  'sold-out':      { label: 'Sold Out',     className: 'badge-sold-out',  icon: XCircle },
  'organic':       { label: 'Organic',      className: 'badge-organic',   icon: Leaf },
  'order-pending': { label: 'Awaiting farmer', className: 'badge-pending', icon: Clock },
  'confirmed':     { label: 'Confirmed',    className: 'badge-verified',  icon: CheckCircle },
  'in-transit':    { label: 'In Transit',   className: 'bg-primary/10 text-primary badge-status', icon: Truck },
  'delivered':     { label: 'Delivered',     className: 'badge-verified',  icon: Package },
  'completed':     { label: 'Completed',    className: 'badge-in-season', icon: CheckCircle },
  'disputed':      { label: 'Disputed',     className: 'badge-sold-out',  icon: AlertTriangle },
  'cancelled':     { label: 'Cancelled',    className: 'bg-muted text-muted-foreground badge-status', icon: XCircle },
  'refunded':      { label: 'Refunded',     className: 'bg-muted text-muted-foreground badge-status', icon: XCircle },
};

export function StatusBadge({ type }: { type: BadgeType }) {
  const c = config[type];
  const Icon = c.icon;
  return (
    <span className={c.className}>
      {Icon && <Icon className="h-3 w-3 mr-1" />}
      {c.label}
    </span>
  );
}
