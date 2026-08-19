import { describe, it, expect } from 'vitest';
import {
  checkTransition,
  availableActions,
  isTerminal,
  TRANSITIONS,
  type OrderStatus,
  type OrderAction,
  type Party,
} from '@/lib/order-lifecycle';

const STATUSES: OrderStatus[] = [
  'PENDING', 'CONFIRMED', 'IN_TRANSIT', 'DELIVERED',
  'COMPLETED', 'DISPUTED', 'CANCELLED', 'REFUNDED',
];
const PARTIES: Party[] = ['buyer', 'farmer', 'admin'];
const ACTIONS = Object.keys(TRANSITIONS) as OrderAction[];

describe('the happy path completes and releases escrow', () => {
  it('walks PENDING -> CONFIRMED -> IN_TRANSIT -> DELIVERED -> COMPLETED', () => {
    expect(checkTransition('confirm', 'PENDING', 'farmer').ok).toBe(true);
    expect(checkTransition('dispatch', 'CONFIRMED', 'farmer').ok).toBe(true);
    expect(checkTransition('mark_delivered', 'IN_TRANSIT', 'farmer').ok).toBe(true);
    expect(checkTransition('confirm_receipt', 'DELIVERED', 'buyer').ok).toBe(true);
  });

  it('releases escrow and credits the farmer only at completion', () => {
    expect(TRANSITIONS.confirm_receipt.payment).toBe('RELEASED');
    expect(TRANSITIONS.confirm_receipt.creditsFarmer).toBe(true);
    // No earlier step may touch the money.
    for (const action of ['confirm', 'dispatch', 'mark_delivered'] as OrderAction[]) {
      expect(TRANSITIONS[action].payment).toBeUndefined();
      expect(TRANSITIONS[action].creditsFarmer).toBeFalsy();
    }
  });
});

describe('a farmer cannot pay themselves', () => {
  it('only the buyer can confirm receipt', () => {
    expect(checkTransition('confirm_receipt', 'DELIVERED', 'buyer').ok).toBe(true);

    const asFarmer = checkTransition('confirm_receipt', 'DELIVERED', 'farmer');
    expect(asFarmer.ok).toBe(false);
    expect(asFarmer.ok === false && asFarmer.code).toBe('forbidden');

    // Not even an admin, who resolves disputes instead.
    expect(checkTransition('confirm_receipt', 'DELIVERED', 'admin').ok).toBe(false);
  });

  it('every action that releases money is buyer- or admin-only', () => {
    for (const action of ACTIONS) {
      if (TRANSITIONS[action].payment === 'RELEASED') {
        expect(TRANSITIONS[action].by).not.toContain('farmer');
      }
    }
  });
});

describe('party permissions', () => {
  it('a buyer cannot drive the farmer-side steps', () => {
    for (const action of ['confirm', 'dispatch', 'mark_delivered'] as OrderAction[]) {
      const result = checkTransition(action, TRANSITIONS[action].from[0]!, 'buyer');
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.code).toBe('forbidden');
    }
  });

  it('only an admin can resolve a dispute', () => {
    for (const action of ['resolve_release', 'resolve_refund'] as OrderAction[]) {
      expect(checkTransition(action, 'DISPUTED', 'admin').ok).toBe(true);
      expect(checkTransition(action, 'DISPUTED', 'buyer').ok).toBe(false);
      expect(checkTransition(action, 'DISPUTED', 'farmer').ok).toBe(false);
    }
  });

  it('only the buyer can raise a dispute', () => {
    expect(checkTransition('raise_dispute', 'IN_TRANSIT', 'buyer').ok).toBe(true);
    expect(checkTransition('raise_dispute', 'IN_TRANSIT', 'farmer').ok).toBe(false);
  });
});

describe('state guards', () => {
  it('cancellation stops once the goods are in transit', () => {
    expect(checkTransition('cancel', 'PENDING', 'buyer').ok).toBe(true);
    expect(checkTransition('cancel', 'CONFIRMED', 'buyer').ok).toBe(true);

    const late = checkTransition('cancel', 'IN_TRANSIT', 'buyer');
    expect(late.ok).toBe(false);
    expect(late.ok === false && late.code).toBe('invalid_state');
  });

  it('distinguishes a permission failure from a state conflict', () => {
    // Right party, wrong moment.
    const state = checkTransition('confirm', 'COMPLETED', 'farmer');
    expect(state.ok === false && state.code).toBe('invalid_state');
    // Wrong party, right moment.
    const perm = checkTransition('confirm', 'PENDING', 'buyer');
    expect(perm.ok === false && perm.code).toBe('forbidden');
  });

  it('rejects an unknown action', () => {
    const result = checkTransition('delete_everything', 'PENDING', 'admin');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe('unknown_action');
  });

  it('no action can be replayed from the state it produces', () => {
    // Guards against a double-click advancing an order twice.
    for (const action of ACTIONS) {
      const t = TRANSITIONS[action];
      expect(t.from).not.toContain(t.to);
    }
  });
});

describe('terminal states are final', () => {
  it.each(['COMPLETED', 'CANCELLED', 'REFUNDED'] as OrderStatus[])(
    '%s admits no further transition by anyone',
    (status) => {
      expect(isTerminal(status)).toBe(true);
      for (const party of PARTIES) {
        expect(availableActions(status, party)).toEqual([]);
      }
    },
  );

  it('active states always leave someone an action', () => {
    for (const status of ['PENDING', 'CONFIRMED', 'IN_TRANSIT', 'DELIVERED', 'DISPUTED'] as OrderStatus[]) {
      const total = PARTIES.flatMap((p) => availableActions(status, p));
      expect(total.length).toBeGreaterThan(0);
    }
  });

  it('an order can never be stranded: every status is terminal or advanceable', () => {
    for (const status of STATUSES) {
      const advanceable = PARTIES.some((p) => availableActions(status, p).length > 0);
      expect(advanceable || isTerminal(status)).toBe(true);
    }
  });
});

describe('stock and money accounting', () => {
  it('every refunding transition returns the stock', () => {
    for (const action of ACTIONS) {
      if (TRANSITIONS[action].payment === 'REFUNDED') {
        expect(TRANSITIONS[action].restoresStock).toBe(true);
      }
    }
  });

  it('stock is never both returned and credited as a sale', () => {
    for (const action of ACTIONS) {
      const t = TRANSITIONS[action];
      expect(t.restoresStock && t.creditsFarmer).toBeFalsy();
    }
  });

  it('a dispute resolution always closes the dispute record', () => {
    expect(TRANSITIONS.resolve_release.closesDispute).toBe('RESOLVED_FARMER');
    expect(TRANSITIONS.resolve_refund.closesDispute).toBe('RESOLVED_BUYER');
  });
});

describe('availableActions drives the UI', () => {
  it('offers the farmer exactly one step at each of their stages', () => {
    expect(availableActions('PENDING', 'farmer')).toEqual(['confirm', 'cancel']);
    expect(availableActions('CONFIRMED', 'farmer')).toEqual(['dispatch', 'cancel']);
    expect(availableActions('IN_TRANSIT', 'farmer')).toEqual(['mark_delivered']);
  });

  it('offers the buyer receipt confirmation or a dispute once delivered', () => {
    expect(availableActions('DELIVERED', 'buyer').sort())
      .toEqual(['confirm_receipt', 'raise_dispute']);
  });

  it('offers nothing to a buyer while the farmer still holds the order', () => {
    expect(availableActions('IN_TRANSIT', 'buyer')).toEqual(['raise_dispute']);
  });
});
