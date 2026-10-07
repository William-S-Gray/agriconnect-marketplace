import { StatusBadge } from '@/components/StatusBadge';

/** One mapping from order status to badge, instead of raw enum text per page. */
const STATUS: Record<string, Parameters<typeof StatusBadge>[0]['type']> = {
  PENDING: 'order-pending',
  CONFIRMED: 'confirmed',
  IN_TRANSIT: 'in-transit',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  DISPUTED: 'disputed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};

export function OrderStatusBadge({ status }: { status: string }) {
  return <StatusBadge type={STATUS[status] ?? 'order-pending'} />;
}
