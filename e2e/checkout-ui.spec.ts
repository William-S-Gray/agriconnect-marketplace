import { test, expect, type Page } from '@playwright/test';
import { BUYER, FARMER, signIn, watchErrors } from './helpers';

/**
 * Checkout UI rules found in QA: delivery needs an address the farmer can see,
 * the payment modal only reports success once the order exists, and the cart
 * cannot be edited below a listing's minimum order.
 */

async function putInCart(page: Page, listingTitle: RegExp) {
  await page.goto('/browse');
  await page.getByRole('link', { name: listingTitle }).first().click();
  const [added] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/buyer/cart') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Add to cart' }).click(),
  ]);
  expect(added.status()).toBe(200);
  await page.goto('/buyer/cart');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.5; }); // see order-lifecycle.spec
});

test('a delivery order needs an address, and the farmer sees it', async ({ page, browser }) => {
  const errors = watchErrors(page);
  await signIn(page, BUYER);
  await putInCart(page, /Roma Tomatoes/);

  await page.getByLabel('Deliver to me').check();
  await page.getByLabel('Delivery address').fill('');
  await expect(page.getByRole('button', { name: /Pay with EcoCash/ })).toBeDisabled();

  const address = `${Date.now()} Samora Machel Ave, Harare`;
  await page.getByLabel('Delivery address').fill(address);
  await page.getByRole('button', { name: /Pay with EcoCash/ }).click();
  await page.getByRole('button', { name: 'Authorise Payment' }).click();
  // Success moves straight on to My Orders, where the delivery details show.
  await page.waitForURL('**/buyer/orders', { timeout: 15_000 });
  await expect(page.getByText(`Delivery to ${address}`)).toBeVisible();

  const farmerCtx = await browser.newContext();
  const farmer = await farmerCtx.newPage();
  await signIn(farmer, FARMER);
  await farmer.goto('/farm/orders');
  await expect(farmer.getByText(`to ${address}`)).toBeVisible();
  await farmerCtx.close();
  expect(errors).toEqual([]);
});

test('the payment modal does not claim success when the order fails', async ({ page, browser }) => {
  await signIn(page, BUYER);
  await putInCart(page, /Garden Peas/);

  // The stock runs out between filling the cart and paying.
  const farmerCtx = await browser.newContext();
  const farmer = await farmerCtx.newPage();
  await signIn(farmer, FARMER);
  const listingId = await page.evaluate(async () => (await (await fetch('/api/buyer/cart')).json()).items[0].listing_id);
  const sold = await farmer.request.patch('/api/farmer/listings', {
    data: { id: listingId, quantity_kg: 0 },
    headers: { origin: new URL(farmer.url()).origin },
  });
  expect(sold.status()).toBe(200);

  await page.getByRole('button', { name: /Pay with EcoCash/ }).click();
  await page.getByRole('button', { name: 'Authorise Payment' }).click();
  await expect(page.getByText('Order not placed')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Payment Confirmed!')).toHaveCount(0);

  await farmer.request.patch('/api/farmer/listings', {
    data: { id: listingId, quantity_kg: 120 },
    headers: { origin: new URL(farmer.url()).origin },
  });
  await farmerCtx.close();
  await page.request.delete('/api/buyer/cart', { headers: { origin: new URL(page.url()).origin } });
});

test('the cart cannot go below the minimum order', async ({ page }) => {
  await signIn(page, BUYER);
  await putInCart(page, /Roma Tomatoes/);
  // Added at the minimum, so decreasing is not offered.
  await expect(page.getByRole('button', { name: 'Decrease quantity' }).first()).toBeDisabled();
  await page.request.delete('/api/buyer/cart', { headers: { origin: new URL(page.url()).origin } });
});
