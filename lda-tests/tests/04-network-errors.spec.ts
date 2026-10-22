import { test, expect } from '@playwright/test';
import { attachLogger, saveLogsToFile } from '../helpers/logger';

test('Offline: analytics queue persists', async ({ page, context }) => {
  const logs = attachLogger(page);

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // قطع شبکه
  await context.setOffline(true);

  // چند رویداد
  await page.evaluate(async () => {
    for (let i = 0; i < 3; i++) {
      await Analytics.track('question_viewed', { question_id: 'project_type' });
    }
  });

  const countOffline = await page.evaluate(() => Analytics.getCount());
  expect(countOffline).toBeGreaterThan(0);

  // آنلاین
  await context.setOffline(false);

  await page.evaluate(() => Analytics.flush());
  await page.waitForTimeout(3000);

  const countOnline = await page.evaluate(() => Analytics.getCount());
  expect(countOnline).toBe(0);

  saveLogsToFile(logs, 'offline_flush');
});