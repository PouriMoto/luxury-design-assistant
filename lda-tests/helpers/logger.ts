import { Page } from '@playwright/test';

export interface CapturedLogs {
  console: { type: string; text: string; timestamp: number }[];
  pageErrors: string[];
  networkErrors: string[];
}

export function attachLogger(page: Page): CapturedLogs {
  const logs: CapturedLogs = { console: [], pageErrors: [], networkErrors: [] };

  page.on('console', (msg) => {
    logs.console.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: Date.now(),
    });
  });

  page.on('pageerror', (err) => {
    logs.pageErrors.push(err.message);
  });

  page.on('requestfailed', (req) => {
    const url = req.url();
    // فیلتر کردن تصاویر 404 که طبق طراحی هستند
    if (url.endsWith('.jpg') || url.endsWith('.png')) return;
    logs.networkErrors.push(`${req.method()} ${url} — ${req.failure()?.errorText}`);
  });

  return logs;
}

export function saveLogsToFile(logs: CapturedLogs, name: string) {
  const fs = require('fs');
  const path = require('path');
  const dir = 'test-results/logs';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${name}.json`),
    JSON.stringify(logs, null, 2)
  );
}