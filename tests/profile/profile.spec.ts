import { test, expect } from '../helpers/fixtures';
import { webUrl } from '../helpers/env';
import { waitForProfileHydrated } from '../helpers/hydration';

test.describe('Profile page', { tag: ['@profile'] }, () => {
  // Each test gets its own freshly-created user, so workers can run in parallel
  // without racing on a shared persona's profile data.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('renders profile form populated from the fresh user', async ({ page, freshParticipant }) => {
    await page.goto(webUrl('/profile'));
    await expect(page.getByRole('heading', { name: 'Your Profile', exact: true })).toBeVisible();

    await waitForProfileHydrated(page, freshParticipant.email);
    await expect(page.locator('#firstName')).toHaveValue(freshParticipant.firstName);
    await expect(page.locator('#lastName')).toHaveValue(freshParticipant.lastName);
  });

  test('updates editable fields and persists them', async ({ page, freshParticipant }) => {
    await page.goto(webUrl('/profile'));
    await waitForProfileHydrated(page, freshParticipant.email);

    const playaName = `PlayaTest-${Date.now().toString(36)}`;
    const phone = '555-0100';
    const emergency = 'E2E Contact 555-0199';

    await page.locator('#playaName').fill(playaName);
    await page.locator('#phone').fill(phone);
    await page.locator('#emergencyContact').fill(emergency);

    await page.getByRole('button', { name: 'Save Profile' }).click();

    await expect(page).toHaveURL(/#\/dashboard/, { timeout: 10_000 });

    await page.goto(webUrl('/profile'));
    await waitForProfileHydrated(page, freshParticipant.email);
    await expect(page.locator('#playaName')).toHaveValue(playaName);
    await expect(page.locator('#phone')).toHaveValue(phone);
    await expect(page.locator('#emergencyContact')).toHaveValue(emergency);
  });

  test('blocks save when a required field is missing', async ({ page, freshParticipant }) => {
    await page.goto(webUrl('/profile'));
    await waitForProfileHydrated(page, freshParticipant.email);

    await page.locator('#firstName').fill('');
    await page.getByRole('button', { name: 'Save Profile' }).click();

    await expect(page).toHaveURL(/#\/profile/, { timeout: 5_000 });
    await expect(page.locator('#firstName')).toBeFocused();
  });
});
