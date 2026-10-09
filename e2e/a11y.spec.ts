import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { BUYER, FARMER, signIn } from './helpers';

/**
 * WCAG 2.1 AA, checked by axe on every page each kind of visitor sees, in both
 * themes. Contrast is where it regresses: dark mode, and text on pale tints
 * (badges). A failure lists the rule and the offending elements.
 */
const PUBLIC = ['/', '/browse', '/prices', '/login', '/register', '/forgot-password'];
const BUYER_PAGES = ['/buyer/dashboard', '/buyer/cart', '/buyer/orders', '/buyer/profile', '/settings/security'];
const FARMER_PAGES = ['/farm/dashboard', '/farm/earnings', '/farm/listings', '/farm/listings/new', '/farm/orders', '/farm/profile'];

async function audit(page: Page, paths: string[]) {
  const found: string[] = [];
  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    for (const v of violations) {
      found.push(`${path}: ${v.id} — ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);
    }
  }
  return found;
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`accessibility, ${theme} mode`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
    });

    test('public pages, a listing and a farm', async ({ page }) => {
      await page.goto('/browse');
      const listing = await page.locator('a[href^="/listing/"]').first().getAttribute('href');
      await page.goto(listing!);
      const farm = await page.locator('a[href^="/farmer/"]').first().getAttribute('href');
      expect(await audit(page, [...PUBLIC, listing!, farm!])).toEqual([]);
    });

    test('buyer pages', async ({ page }) => {
      await signIn(page, BUYER);
      expect(await audit(page, BUYER_PAGES)).toEqual([]);
    });

    test('farmer pages', async ({ page }) => {
      await signIn(page, FARMER);
      expect(await audit(page, FARMER_PAGES)).toEqual([]);
    });
  });
}
