import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45000,
  fullyParallel: false,
  retries: 0,
  workers: 1,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:8000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'fa-IR',
    viewport: { width: 420, height: 900 },
    channel: 'chrome',              // ← 🆕 استفاده از Chrome نصب‌شده
  },

  projects: [
    { name: 'chrome', use: { channel: 'chrome' } },
  ],

  webServer: {
    command: 'npx http-server .. -p 8000 -c-1 --silent',
    port: 8000,
    reuseExistingServer: true,
    timeout: 20000,
  },
});