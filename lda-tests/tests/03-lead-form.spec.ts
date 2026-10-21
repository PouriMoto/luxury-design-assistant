import { test, expect } from '@playwright/test';
import { attachLogger, saveLogsToFile } from '../helpers/logger';

async function goToResult(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'شروع کنیم' }).click();
  await page.getByRole('button', { name: 'ویلا', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'در مرحله طراحی یا ساخت' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'گرم و طبیعی', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'زیبایی و هماهنگی بصری' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'یک تا سه ماه آینده' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'ابعاد فضا مشخص است' }).click();
  await page.waitForTimeout(2500);
}

test('Lead form: validation — short name', async ({ page }) => {
  await goToResult(page);
  await page.locator('.next-actions button', { hasText: 'مشاوره' }).click();
  await page.waitForTimeout(800);

  await page.locator('#lead-name').fill('ع');
  await page.locator('#lead-phone').fill('09121234567');
  await page.locator('form button[type="submit"]').click();

  await expect(page.locator('[data-error="name"]')).toContainText('حداقل ۲');
});

test('Lead form: validation — invalid phone', async ({ page }) => {
  await goToResult(page);
  await page.locator('.next-actions button', { hasText: 'مشاوره' }).click();
  await page.waitForTimeout(800);

  await page.locator('#lead-name').fill('علی رضایی');
  await page.locator('#lead-phone').fill('12345');
  await page.locator('form button[type="submit"]').click();

  await expect(page.locator('[data-error="phone"]')).toContainText('۱۱ رقم');
});

test('Lead form: successful submit (real or preview)', async ({ page }) => {
  const logs = attachLogger(page);
  await goToResult(page);
  await page.locator('.next-actions button', { hasText: 'مشاوره' }).click();
  await page.waitForTimeout(800);

  await page.locator('#lead-name').fill('تست پلی‌رایت');
  await page.locator('#lead-phone').fill('09121234567');
  await page.locator('#lead-consent').check();
  await page.locator('form button[type="submit"]').click();

  // یا "ثبت شد" (واقعی) یا "پیش‌نمایش"
  await expect(
    page.locator('.badge--success, .badge--muted')
  ).toBeVisible({ timeout: 15000 });

  saveLogsToFile(logs, 'lead_form_success');
});