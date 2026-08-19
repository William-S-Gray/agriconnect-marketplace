/**
 * The order state machine.
 *
 * Orders were previously created and then frozen: nothing could advance them,
 * so escrow never released and every status past PENDING was unreachable.
 *
 * Transitions are declared in one table rather than scattered across route
 * handlers, so the answer to "who can do what, and when" is readable in one
 * place and testable without HTTP. The route handler's only job is to identify
 * the caller's relationship to the order and hand it to `applyTransition`.
 *
 * Party, not role: a farmer may confirm *their own* order, not any order. The
 * caller resolves the relationship (buyer / farmer / admin on this order) and
 * passes it in; this module never trusts a role by itself.
 */

export type OrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'IN_TRANSIT' | 'DELIVERED'
  | 'COMPLETED' | 'DISPUTED' | 'CANCELLED' | 'REFUNDED';

export type PaymentStatus =
  | 'UNPAID' | 'PAID' | 'HELD_ESCROW' | 'RELEASED' | 'REFUNDED';

/** The caller's relationship to this specific order. */
export type Party = 'buyer' | 'farmer' | 'admin';

export type OrderAction =
  | 'confirm'        // farmer accepts the order
  | 'dispatch'       // farmer sends it
  | 'mark_delivered' // farmer says it arrived
  | 'confirm_receipt'// buyer confirms -> releases escrow
  | 'cancel'         // either party, before the goods move
  | 'raise_dispute'  // buyer disputes after dispatch
  | 'resolve_release'// admin resolves a dispute in the farmer's favour
  | 'resolve_refund';// admin resolves in the buyer's favour

export interface Transition {
  from: OrderStatus[];
  to: OrderStatus;
  /** Who may perform it. Checked against the caller's party on this order. */
  by: Party[];
  payment?: PaymentStatus;
  /** Return the reserved stock to the listing. */
  restoresStock?: boolean;
  /** Count the sale toward the farmer's totals. */
  creditsFarmer?: boolean;
  /** Open a dispute record alongside the status change. */
  opensDispute?: boolean;
  /** Close any open dispute on the order with this outcome. */
  closesDispute?: 'RESOLVED_BUYER' | 'RESOLVED_FARMER';
  /** Sets orders.buyer_confirmed. */
  setsBuyerConfirmed?: boolean;
  /** Shown to the user when the action is not allowed from the current state. */
  describe: string;
}

export const TRANSITIONS: Record<OrderAction, Transition> = {
  confirm: {
    from: ['PENDING'], to: 'CONFIRMED', by: ['farmer', 'admin'],
    describe: 'Only a pending order can be confirmed.',
  },
  dispatch: {
    from: ['CONFIRMED'], to: 'IN_TRANSIT', by: ['farmer', 'admin'],
    describe: 'Only a confirmed order can be dispatched.',
  },
  mark_delivered: {
    from: ['IN_TRANSIT'], to: 'DELIVERED', by: ['farmer', 'admin'],
    describe: 'Only an order in transit can be marked delivered.',
  },
  confirm_receipt: {
    // The buyer releasing escrow is the point of the whole flow, so it is
    // deliberately the buyer's action alone -- a farmer marking their own
    // delivery complete must not pay themselves.
    from: ['DELIVERED'], to: 'COMPLETED', by: ['buyer'],
    payment: 'RELEASED', creditsFarmer: true, setsBuyerConfirmed: true,
    describe: 'Only a delivered order can be confirmed as received.',
  },
  cancel: {
    // Allowed until the goods are in transit; after that it is a dispute.
    from: ['PENDING', 'CONFIRMED'], to: 'CANCELLED', by: ['buyer', 'farmer', 'admin'],
    payment: 'REFUNDED', restoresStock: true,
    describe: 'An order can only be cancelled before it is dispatched.',
  },
  raise_dispute: {
    from: ['IN_TRANSIT', 'DELIVERED'], to: 'DISPUTED', by: ['buyer'],
    opensDispute: true,
    describe: 'A dispute can only be raised once the order is on its way.',
  },
  resolve_release: {
    from: ['DISPUTED'], to: 'COMPLETED', by: ['admin'],
    payment: 'RELEASED', creditsFarmer: true, closesDispute: 'RESOLVED_FARMER',
    describe: 'Only a disputed order can be resolved.',
  },
  resolve_refund: {
    from: ['DISPUTED'], to: 'REFUNDED', by: ['admin'],
    payment: 'REFUNDED', restoresStock: true, closesDispute: 'RESOLVED_BUYER',
    describe: 'Only a disputed order can be resolved.',
  },
};

export type TransitionCheck =
  | { ok: true; transition: Transition }
  | { ok: false; code: 'unknown_action' | 'forbidden' | 'invalid_state'; message: string };

/**
 * Decides whether `party` may apply `action` to an order in `status`.
 *
 * Pure, so the rules can be tested exhaustively without a database. The
 * distinction between forbidden and invalid_state matters: the first is an
 * authorization failure (403), the second a conflict with the order's current
 * state (409), and collapsing them would tell a caller the wrong thing.
 */
export function checkTransition(
  action: string,
  status: OrderStatus,
  party: Party,
): TransitionCheck {
  const transition = (TRANSITIONS as Record<string, Transition>)[action];
  if (!transition) {
    return { ok: false, code: 'unknown_action', message: 'Unknown action.' };
  }
  if (!transition.by.includes(party)) {
    return {
      ok: false,
      code: 'forbidden',
      message: 'You do not have permission to perform this action on this order.',
    };
  }
  if (!transition.from.includes(status)) {
    return { ok: false, code: 'invalid_state', message: transition.describe };
  }
  return { ok: true, transition };
}

/** Actions this party could take right now. Drives which buttons to render. */
export function availableActions(status: OrderStatus, party: Party): OrderAction[] {
  return (Object.keys(TRANSITIONS) as OrderAction[]).filter(
    (action) => checkTransition(action, status, party).ok,
  );
}

/** Terminal states: no further transition is possible from these. */
export function isTerminal(status: OrderStatus): boolean {
  return availableActions(status, 'admin').length === 0
    && availableActions(status, 'buyer').length === 0
    && availableActions(status, 'farmer').length === 0;
}
