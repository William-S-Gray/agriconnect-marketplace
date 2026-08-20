/**
 * Review eligibility and farmer rating maintenance.
 *
 * Reviews were unreachable: the table and the profile page existed, but nothing
 * could create one, so farmer ratings were frozen at whatever the fixtures had
 * invented.
 *
 * The rule that matters is that a review must be earned. Only the buyer on the
 * order may write one, and only once the order has actually COMPLETED -- which
 * in this app means the buyer confirmed receipt and escrow was released. That
 * makes a rating expensive to forge: you have to place a real order, have it
 * delivered, and confirm it.
 */

import type { OrderStatus } from './order-lifecycle';

export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const MAX_COMMENT_LENGTH = 2000;

export type ReviewBlockReason =
  | 'not_buyer'      // only the buyer on the order may review it
  | 'not_completed'  // the order has not been completed
  | 'already_reviewed';

export type ReviewEligibility =
  | { ok: true }
  | { ok: false; reason: ReviewBlockReason; message: string };

/**
 * Pure eligibility check, so the rules can be tested without a database and
 * reused by the page to decide whether to render the form.
 */
export function checkReviewEligibility(input: {
  isBuyer: boolean;
  status: OrderStatus;
  alreadyReviewed: boolean;
}): ReviewEligibility {
  if (!input.isBuyer) {
    return {
      ok: false,
      reason: 'not_buyer',
      message: 'Only the buyer on an order can review it.',
    };
  }
  if (input.status !== 'COMPLETED') {
    return {
      ok: false,
      reason: 'not_completed',
      message: 'You can review an order once you have confirmed you received it.',
    };
  }
  if (input.alreadyReviewed) {
    return {
      ok: false,
      reason: 'already_reviewed',
      message: 'You have already reviewed this order.',
    };
  }
  return { ok: true };
}

/** Validates a submitted rating. Returns null when acceptable. */
export function validateRating(rating: unknown): string | null {
  if (typeof rating !== 'number' || !Number.isInteger(rating)) {
    return 'A rating must be a whole number of stars.';
  }
  if (rating < MIN_RATING || rating > MAX_RATING) {
    return `A rating must be between ${MIN_RATING} and ${MAX_RATING} stars.`;
  }
  return null;
}

/**
 * SQL that recomputes a farmer's rating and review count from the reviews
 * table.
 *
 * Recomputed rather than incremented on purpose: an increment drifts the moment
 * a review is removed or a backfill runs, whereas this is self-correcting and
 * makes the reviews table the single source of truth. It also replaces the
 * fabricated counts the fixtures ship with, the first time a farmer is reviewed
 * for real.
 *
 * Takes the farmer id as $1.
 */
export const RECALCULATE_FARMER_RATING = `
  UPDATE farmers f
     SET rating = COALESCE(
           (SELECT ROUND(AVG(r.rating)::numeric, 2) FROM reviews r WHERE r.farmer_id = f.id),
           0
         ),
         total_reviews = (SELECT count(*) FROM reviews r WHERE r.farmer_id = f.id),
         updated_at = now()
   WHERE f.id = $1
`;

/** Average used by the tests and by any future backfill, kept in one place. */
export function averageRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((total, r) => total + r, 0);
  return Math.round((sum / ratings.length) * 100) / 100;
}
