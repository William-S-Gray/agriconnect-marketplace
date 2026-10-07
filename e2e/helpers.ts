import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'AgriDemo!2026';
export const BUYER = 'kuda@email.co.zw';
export const FARMER = 'john@moyofarm.co.zw';

/** Collects console errors and uncaught exceptions for the page's lifetime. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

export async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}
