import { test, expect } from '@playwright/test';
import { webUrl } from '../helpers/env';

const REPORT_PAGES = [
  { path: '/reports', heading: /reports/i },
  { path: '/reports/registrations', heading: /registration reports/i },
  { path: '/reports/users', heading: /user reports/i },
  { path: '/reports/work-schedule', heading: /work schedule/i },
  { path: '/reports/payments', heading: /payment reports/i },
];

test.describe('Reports (admin)', { tag: ['@reports'] }, () => {
  test.use({ storageState: 'tests/.auth/admin.json' });

  for (const { path, heading } of REPORT_PAGES) {
    test(`${path} loads with expected heading`, async ({ page }) => {
      await page.goto(webUrl(path));
      await expect(page.getByRole('heading').filter({ hasText: heading }).first()).toBeVisible({
        timeout: 10_000,
      });
    });
  }
});

test.describe('Reports (staff)', { tag: ['@reports'] }, () => {
  test.use({ storageState: 'tests/.auth/staff.json' });

  test('staff can reach the reports index', async ({ page }) => {
    await page.goto(webUrl('/reports'));
    await expect(page.getByRole('heading').filter({ hasText: /reports/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
