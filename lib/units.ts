/**
 * Quantity rules shared by the cart, checkout and listing forms.
 *
 * Quantities are stored as NUMERIC(12,2). A value with more decimals was
 * silently rounded — 0.0001 became 0.00 and then failed the database's
 * quantity > 0 check with a 500 — and count units accepted fractions, so half
 * a chicken could be ordered.
 */
import { UNITS } from './mock-data';

/** Sold by the piece: quantities must be whole numbers. */
export const COUNT_UNITS: ReadonlySet<string> = new Set(['crate', 'bundle', 'dozen', 'head']);

export const isUnit = (u: string): u is (typeof UNITS)[number] => (UNITS as readonly string[]).includes(u);

/** Why a quantity is unacceptable for a unit, or null when it is fine. */
export function quantityProblem(quantity: number, unit: string): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return 'Quantity must be more than zero.';
  if (Math.abs(Math.round(quantity * 100) - quantity * 100) > 1e-6) return 'Quantity can have at most two decimal places.';
  if (COUNT_UNITS.has(unit) && !Number.isInteger(quantity)) return `Quantities in ${unit} must be whole numbers.`;
  return null;
}
