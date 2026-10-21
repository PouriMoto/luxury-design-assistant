import { test, expect } from '@playwright/test';

test('Keyboard navigation', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Tab به دکمه شروع
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');

  const focused = await page.evaluate(() =>
    document.activeElement?.textContent?.trim()
  );
  expect(focused).toBeTruthy();
});

test('RTL layout', async ({ page }) => {
  await page.goto('/');
  const dir = await page.locator('html').getAttribute('dir');
  expect(dir).toBe('rtl');
});

test('Mobile 320px — no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  const hasHScroll = await page.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth
  );
  expect(hasHScroll).toBe(false);
});