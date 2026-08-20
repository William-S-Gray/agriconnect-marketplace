import { describe, it, expect } from 'vitest';
import {
  checkReviewEligibility,
  validateRating,
  averageRating,
  MIN_RATING,
  MAX_RATING,
} from '@/lib/reviews';
import type { OrderStatus } from '@/lib/order-lifecycle';

const NON_COMPLETED: OrderStatus[] = [
  'PENDING', 'CONFIRMED', 'IN_TRANSIT', 'DELIVERED',
  'DISPUTED', 'CANCELLED', 'REFUNDED',
];

describe('a review has to be earned', () => {
  it('allows the buyer on a completed order', () => {
    expect(checkReviewEligibility({
      isBuyer: true, status: 'COMPLETED', alreadyReviewed: false,
    }).ok).toBe(true);
  });

  it.each(NON_COMPLETED)('refuses a %s order', (status) => {
    const result = checkReviewEligibility({ isBuyer: true, status, alreadyReviewed: false });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('not_completed');
  });

  it('refuses a refunded order, so a refund cannot buy a rating', () => {
    const result = checkReviewEligibility({
      isBuyer: true, status: 'REFUNDED', alreadyReviewed: false,
    });
    expect(result.ok).toBe(false);
  });

  it('refuses anyone who is not the buyer', () => {
    const result = checkReviewEligibility({
      isBuyer: false, status: 'COMPLETED', alreadyReviewed: false,
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('not_buyer');
  });

  it('refuses a second review for the same order', () => {
    const result = checkReviewEligibility({
      isBuyer: true, status: 'COMPLETED', alreadyReviewed: true,
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('already_reviewed');
  });

  it('reports the authorization failure ahead of the state failure', () => {
    // A non-buyer on a non-completed order should be told the former, so the
    // response never confirms an order's state to someone unrelated to it.
    const result = checkReviewEligibility({
      isBuyer: false, status: 'PENDING', alreadyReviewed: false,
    });
    expect(result.ok === false && result.reason).toBe('not_buyer');
  });
});

describe('rating validation', () => {
  it.each([1, 2, 3, 4, 5])('accepts %i stars', (n) => {
    expect(validateRating(n)).toBeNull();
  });

  it.each([0, 6, -1, 100])('rejects %i', (n) => {
    expect(validateRating(n)).not.toBeNull();
  });

  it('rejects fractional and non-numeric ratings', () => {
    expect(validateRating(4.5)).not.toBeNull();
    expect(validateRating('5')).not.toBeNull();
    expect(validateRating(null)).not.toBeNull();
    expect(validateRating(undefined)).not.toBeNull();
    expect(validateRating(Number.NaN)).not.toBeNull();
  });

  it('names the accepted range in the message', () => {
    expect(validateRating(9)).toContain(String(MAX_RATING));
    expect(validateRating(0)).toContain(String(MIN_RATING));
  });
});

describe('average rating', () => {
  it('is zero with no reviews, so an unrated farmer is not flattered', () => {
    expect(averageRating([])).toBe(0);
  });

  it('averages and rounds to two decimals', () => {
    expect(averageRating([5, 4])).toBe(4.5);
    expect(averageRating([5, 4, 4])).toBe(4.33);
    expect(averageRating([1, 2, 2])).toBe(1.67);
  });

  it('handles a single review', () => {
    expect(averageRating([3])).toBe(3);
  });

  it('stays within the rating scale', () => {
    expect(averageRating([5, 5, 5])).toBe(5);
    expect(averageRating([1, 1, 1])).toBe(1);
  });

  it('fits the NUMERIC(3,2) column the schema declares', () => {
    // Two decimals and a single leading digit: 5.00 is the widest value.
    const widest = averageRating([5, 5]).toFixed(2);
    expect(widest).toBe('5.00');
    expect(widest.replace('.', '').length).toBeLessThanOrEqual(3);
  });
});
