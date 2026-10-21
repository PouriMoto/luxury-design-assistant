import { test, expect } from '@playwright/test';
import { attachLogger, saveLogsToFile } from '../helpers/logger';

// ۴ ترکیب از ۴ سبک، همه بدون contractor
const happyPaths = [
  { name: 'home → modern_minimal',     type: 'خانه شخصی',         style: 'مدرن مینیمال' },
  { name: 'villa → warm_natural',      type: 'ویلا',              style: 'گرم و طبیعی' },
  { name: 'commercial → lux',          type: 'فضای تجاری',        style: 'معاصر لوکس' },
  { name: 'multi_unit → classic',      type: 'ساختمان چندواحدی',  style: 'کلاسیک معاصر' },
];

happyPaths.forEach((scenario) => {
  test(`Happy path: ${scenario.name}`, async ({ page }) => {
    const logs = attachLogger(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Intro → Start
    await page.getByRole('button', { name: 'شروع کنیم' }).click();

    // project_type
    await page.getByRole('button', { name: scenario.type, exact: true }).click();
    await page.waitForTimeout(1500);

    // project_stage
    await page.getByRole('button', { name: 'ملک را تحویل گرفته‌ام' }).click();
    await page.waitForTimeout(1500);

    // preferred_style — کارت تصویری
    await page.getByRole('button', { name: scenario.style, exact: true }).click();
    await page.waitForTimeout(1500);

    // design_priority
    await page.getByRole('button', { name: 'کیفیت متریال و جزئیات' }).click();
    await page.waitForTimeout(1500);

    // project_timeline
    await page.getByRole('button', { name: 'یک تا سه ماه آینده' }).click();
    await page.waitForTimeout(1500);

    // measurement_status
    await page.getByRole('button', { name: 'ابعاد فضا مشخص است' }).click();
    await page.waitForTimeout(1500);

    // نتیجه باید ظاهر شود
    await expect(page.locator('.result-hero')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.chart-block')).toBeVisible();

    // Debug panel
    await page.locator('.debug-panel summary').click();
    const debugText = await page.locator('.debug-content').textContent();
    expect(debugText).toContain('Style Scores');
    expect(debugText).toContain('Lead Priority');

    saveLogsToFile(logs, scenario.name.replace(/\s+/g, '_'));

    // هیچ خطای صفحه‌ای نباید باشد
    expect(logs.pageErrors).toEqual([]);
  });
});