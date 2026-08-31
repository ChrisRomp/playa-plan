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

  test('registration fields load for current and historical report years', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('registrationReports_showCampingOptions');
    });
    await page.route('**/public/config', async (route) => {
      const response = await route.fetch();
      const config = await response.json();
      await route.fulfill({
        response,
        json: {
          ...config,
          registrationOpen: false,
        },
      });
    });
    await page.goto(webUrl('/reports/registrations'));

    const campingFieldsResponse = page.waitForResponse((response) =>
      response.url().includes('/admin/registrations/camping-options-with-fields?year='),
    );
    await page.getByRole('button', { name: 'Show Registration Fields' }).click();

    expect((await campingFieldsResponse).ok()).toBe(true);
    await expect(page.getByRole('columnheader', { name: 'Camping Option' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Camping Footprint' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Vehicle Length' })).toBeVisible();
    await expect(page.getByRole('columnheader', {
      name: 'How many skydives have you done in total?',
    })).toBeVisible();
    const activeReportRow = page.getByRole('row').filter({
      hasText: 'e2e-admin@test.playaplan.local',
    });
    const inactiveReportRow = page.getByRole('row').filter({
      hasText: 'e2e-staff@test.playaplan.local',
    });
    await expect(activeReportRow).toContainText('Skydiving');
    await expect(activeReportRow).toContainText('20 by 30 feet');
    await expect(inactiveReportRow).toContainText('RV Camping');
    await expect(inactiveReportRow).toContainText('24 feet');

    const footprintColumnIndex = await page
      .getByRole('columnheader', { name: 'Camping Footprint' })
      .evaluate((element: HTMLTableCellElement) => element.cellIndex);
    const vehicleLengthColumnIndex = await page
      .getByRole('columnheader', { name: 'Vehicle Length' })
      .evaluate((element: HTMLTableCellElement) => element.cellIndex);
    const unfilledFieldColumnIndex = await page
      .getByRole('columnheader', { name: 'How many skydives have you done in total?' })
      .evaluate((element: HTMLTableCellElement) => element.cellIndex);

    await expect(activeReportRow.locator('td').nth(vehicleLengthColumnIndex)).toHaveText('');
    await expect(inactiveReportRow.locator('td').nth(footprintColumnIndex)).toHaveText('');
    await expect(activeReportRow.locator('td').nth(unfilledFieldColumnIndex)).toHaveText('');

    await page.getByRole('button', { name: 'Filters' }).click();
    const yearFilter = page.getByLabel('Year');
    const currentYear = await yearFilter.inputValue();
    const availableYears = await yearFilter.locator('option').evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );
    const historicalYear = availableYears
      .filter((value) => value && value !== currentYear)
      .sort()
      .at(0) ?? '';
    expect(historicalYear).not.toBe('');

    const historicalFieldsResponse = page.waitForResponse((response) =>
      response.url().includes(
        `/admin/registrations/camping-options-with-fields?year=${historicalYear}`,
      ),
    );
    await yearFilter.selectOption(historicalYear);

    expect((await historicalFieldsResponse).ok()).toBe(true);
    const historicalReportRow = page.getByRole('row').filter({
      hasText: 'e2e-staff@test.playaplan.local',
    });
    await expect(historicalReportRow).toContainText('RV Camping');
    await expect(historicalReportRow).toContainText('22 feet in prior year');
  });
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
