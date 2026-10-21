import { test, expect } from '@playwright/test';

test('Contractor path should not loop and should capture logs', async ({ page }) => {
  // 1. شنود تمام پیام‌های کنسول مرورگر
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    console.log(text); // چاپ در ترمینال برای دیباگ سریع
  });

  // 2. شنود خطاهای صفحه (Uncaught errors)
  page.on('pageerror', err => {
    console.error(`[PAGE ERROR] ${err.message}`);
    consoleLogs.push(`[PAGE ERROR] ${err.message}`);
  });

  // 3. باز کردن صفحه (آدرس سرور محلی خودت)
  await page.goto('http://localhost:8000');
  await page.waitForLoadState('networkidle');

  // 4. کلیک روی دکمه شروع
  await page.getByRole('button', { name: 'شروع کنیم' }).click();

  // 5. انتخاب "پروژه پیمانکاری"
  await page.getByRole('button', { name: 'پروژه پیمانکاری' }).click();

  // 6. منتظر ماندن برای ظاهر شدن سؤال بعدی (contractor_scope)
  // اگر باگ حلقه وجود داشته باشد، اینجا تست fail می‌شود
  await expect(page.getByText('پروژه‌ای که برای مشتری مدیریت می‌کنی')).toBeVisible({ timeout: 5000 });

  // 7. انتخاب یک گزینه از contractor_scope
  await page.getByRole('button', { name: 'مسکونی' }).click();

  // 8. بررسی اینکه به design_priority رفته و حلقه نزده
  await expect(page.getByText('اگر یک ویژگی در انتخاب کابینت برایت مهم‌تر باشد')).toBeVisible({ timeout: 5000 });

  // 9. (اختیاری) پرینت تمام لاگ‌های گرفته شده در پایان تست
  console.log('\n--- ALL CONSOLE LOGS ---');
  consoleLogs.forEach(log => console.log(log));
});