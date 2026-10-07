import { test, expect, type Page } from '@playwright/test';
import { BUYER, FARMER, signIn, watchErrors } from './helpers';

/**
 * The money path, through the real UI: a buyer orders and pays (simulated),
 * the farmer confirms, dispatches and delivers, the buyer confirms receipt —
 * releasing escrow — and reviews the farm.
 */
const LISTING = 'Roma Tomatoes — Chemical Free'; // sold by the seeded farmer, John Moyo

test('order → confirm → dispatch → deliver → receive → review', async ({ browser }) => {
  const buyerCtx = await browser.newContext();
  const farmerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  const farmer = await farmerCtx.newPage();
  const errors = [...watchErrors(buyer), ...watchErrors(farmer)];

  // The simulated EcoCash step fails 5% of the time on purpose, to show its
  // error screen. Pin it to success so this test is deterministic.
  await buyer.addInitScript(() => { Math.random = () => 0.5; });

  // ── Buyer orders ──
  await signIn(buyer, BUYER);
  await buyer.goto('/browse');
  await buyer.getByRole('link', { name: new RegExp(LISTING) }).first().click();
  const [added] = await Promise.all([
    buyer.waitForResponse((r) => r.url().endsWith('/api/buyer/cart') && r.request().method() === 'POST'),
    buyer.getByRole('button', { name: 'Add to cart' }).click(),
  ]);
  expect(added.status()).toBe(200);
  await buyer.goto('/buyer/cart');
  await buyer.getByRole('button', { name: /Pay with EcoCash/ }).click();
  await buyer.getByRole('button', { name: 'Authorise Payment' }).click();
  const placed = buyer.getByText(/Order AG-\d{4}-[0-9A-F]{10} placed/);
  await expect(placed).toBeVisible({ timeout: 15_000 });
  const reference = /AG-\d{4}-[0-9A-F]{10}/.exec((await placed.textContent()) ?? '')![0];

  const order = (page: Page) => page.locator('li', { hasText: reference });

  /**
   * Clicks an order action and waits for the server to accept it. Waiting on
   * text alone is not enough: "Confirmed" and "Delivered" are also timeline
   * step labels, so they are on the page before the action has happened.
   */
  async function act(page: Page, action: string) {
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/orders/') && r.request().method() === 'PATCH'),
      order(page).getByRole('button', { name: action }).click(),
    ]);
    expect(response.status(), action).toBe(200);
    await expect(order(page).getByRole('button', { name: action })).toHaveCount(0);
  }

  await buyer.waitForURL('**/buyer/orders');
  await expect(order(buyer).getByText('Awaiting farmer')).toBeVisible();

  // ── Farmer fulfils ──
  await signIn(farmer, FARMER);
  await farmer.goto('/farm/orders');
  for (const action of ['Confirm order', 'Mark dispatched', 'Mark delivered']) {
    await act(farmer, action);
  }

  // ── Buyer confirms receipt, which releases escrow, then reviews ──
  await buyer.reload();
  await act(buyer, 'Confirm receipt');
  await expect(order(buyer).getByRole('list', { name: 'Order progress: Completed' })).toBeVisible();
  await expect(order(buyer).getByText('Payment: Paid out')).toBeVisible();

  await order(buyer).getByRole('button', { name: /review/i }).click();
  await order(buyer).getByRole('radio', { name: '5 stars' }).click();
  await order(buyer).getByLabel('Comment (optional)').fill('Firm, ripe and well packed.');
  await order(buyer).getByRole('button', { name: 'Publish review' }).click();
  await expect(order(buyer).getByText('Firm, ripe and well packed.')).toBeVisible();

  expect(errors).toEqual([]);
  await buyerCtx.close();
  await farmerCtx.close();
});
