import { test, expect } from '@playwright/test';
import { BUYER, FARMER, signIn, watchErrors } from './helpers';

/**
 * Every page, for every kind of visitor, in both themes: it must load without
 * a console error or uncaught exception. This is the check that would have
 * caught /prices returning 500 and dark mode silently reverting to light.
 */
const PUBLIC = ['/', '/browse', '/prices', '/login', '/register', '/forgot-password', '/reset-password?token=x'];
const BUYER_PAGES = ['/buyer/dashboard', '/buyer/cart', '/buyer/orders', '/buyer/profile', '/settings/security'];
const FARMER_PAGES = ['/farm/dashboard', '/farm/earnings', '/farm/listings', '/farm/listings/new', '/farm/orders', '/farm/profile'];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} mode`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
    });

    test('public pages, including a listing and a farm', async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto('/browse');
      const listingHref = await page.locator('a[href^="/listing/"]').first().getAttribute('href');
      for (const path of [...PUBLIC, listingHref!]) {
        const res = await page.goto(path);
        expect(res?.status(), path).toBe(200);
        // The theme survives hydration (it used to be dropped on pages with the toggle).
        await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/);
      }
      expect(errors).toEqual([]);
    });

    test('buyer pages', async ({ page }) => {
      const errors = watchErrors(page);
      await signIn(page, BUYER);
      for (const path of BUYER_PAGES) expect((await page.goto(path))?.status(), path).toBe(200);
      expect(errors).toEqual([]);
    });

    test('farmer pages', async ({ page }) => {
      const errors = watchErrors(page);
      await signIn(page, FARMER);
      for (const path of FARMER_PAGES) expect((await page.goto(path))?.status(), path).toBe(200);
      expect(errors).toEqual([]);
    });
  });
}

test('the market prices chart draws', async ({ page }) => {
  await page.goto('/prices');
  await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible();
  await expect(page.getByLabel('Loading chart')).toHaveCount(0);
});

test('phones can reach Browse and Prices through the menu', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'Market prices' }).click();
  await expect(page).toHaveURL(/\/prices$/);
});
