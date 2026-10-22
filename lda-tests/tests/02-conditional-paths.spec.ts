import { test, expect } from '@playwright/test';
import { attachLogger, saveLogsToFile } from '../helpers/logger';

test('Conditional: contractor branch — no loop', async ({ page }) => {
  const logs = attachLogger(page);

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'شروع کنیم' }).click();

  // project_type = contractor
  await page.getByRole('button', { name: 'پروژه پیمانکاری', exact: true }).click();
  await page.waitForTimeout(1500);

  // باید contractor_scope بیاید، نه project_stage
  await expect(
    page.getByText('پروژه‌ای که برای مشتری مدیریت می‌کنی')
  ).toBeVisible({ timeout: 5000 });

  // نباید خطای حلقه باشد
  const loopError = page.locator('.error-bubble');
  await expect(loopError).not.toBeVisible();

  // یک گزینه انتخاب کن
  await page.getByRole('button', { name: 'مسکونی', exact: true }).click();
  await page.waitForTimeout(1500);

  // باید design_priority بیاید
  await expect(
    page.getByText('اگر یک ویژگی در انتخاب کابینت برایت مهم‌تر باشد')
  ).toBeVisible({ timeout: 5000 });

  // ادامه تا نتیجه
  await page.getByRole('button', { name: 'طراحی خاص و متفاوت' }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'بیش از شش ماه دیگر' }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'نقشه اجرایی و اطلاعات کامل دارم' }).click();
  await page.waitForTimeout(1500);

  await expect(page.locator('.result-hero')).toBeVisible({ timeout: 8000 });

  saveLogsToFile(logs, 'contractor_branch');
  expect(logs.pageErrors).toEqual([]);
});

test('Back button — preserves answers', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'شروع کنیم' }).click();

  await page.getByRole('button', { name: 'ویلا', exact: true }).click();
  await page.waitForTimeout(1500);

  await page.getByRole('button', { name: 'در حال بررسی ایده‌ها' }).click();
  await page.waitForTimeout(1500);

  // کلیک Back
  await page.getByRole('button', { name: 'سؤال قبلی' }).click();
  await page.waitForTimeout(800);

  // باید سؤال project_stage دوباره ظاهر شود
  await expect(
    page.getByText('پروژه‌ات الان در چه مرحله‌ای قرار داره')
  ).toBeVisible();

  // پاسخ قبلی در state هست؟ (از طریق debug)
  const answers = await page.evaluate(() => window.__lda.state().answers);
  expect(answers.project_type).toBe('villa');
});