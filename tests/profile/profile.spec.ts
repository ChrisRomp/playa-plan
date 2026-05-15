import { test, expect } from '@playwright/test';
import { webUrl } from '../helpers/env';

// Profile mutations target the shared participant persona; serialize so two workers
// don't race on the same record.
test.describe.configure({ mode: 'serial' });

test.describe('Profile page', { tag: ['@profile'] }, () => {
  // Run as the participant persona; profile edits don't affect other tests.
  test.use({ storageState: 'tests/.auth/participant.json' });

  test('renders profile form populated from the persona', async ({ page }) => {
    await page.goto(webUrl('/profile'));
    // Two headings start with "Profile" — the page H1 "Your Profile" and a section H2
    // "Complete Your Profile". Use exact match to disambiguate.
    await expect(page.getByRole('heading', { name: 'Your Profile', exact: true })).toBeVisible();

    // Wait for the form to be hydrated from the API before asserting values.
    await expect(page.locator('#email')).toHaveValue(
      'e2e-participant@test.playaplan.local',
      { timeout: 10_000 },
    );
    await expect(page.locator('#firstName')).toHaveValue('E2E');
    await expect(page.locator('#lastName')).toHaveValue('Participant');
  });

  test('updates editable fields and persists them', async ({ page }) => {
    await page.goto(webUrl('/profile'));

    // Wait for the form's useEffect to populate from the loaded profile, otherwise
    // it will overwrite our fills mid-flight and validation will reject the save.
    await expect(page.locator('#email')).toHaveValue(
      'e2e-participant@test.playaplan.local',
      { timeout: 10_000 },
    );

    const playaName = `PlayaTest-${Date.now().toString(36)}`;
    const phone = '555-0100';
    const emergency = 'E2E Contact 555-0199';

    await page.locator('#playaName').fill(playaName);
    await page.locator('#phone').fill(phone);
    await page.locator('#emergencyContact').fill(emergency);

    await page.getByRole('button', { name: 'Save Profile' }).click();

    // ProfileForm navigates to /dashboard on successful save.
    await expect(page).toHaveURL(/#\/dashboard/, { timeout: 10_000 });

    // Reload the profile and confirm persistence.
    await page.goto(webUrl('/profile'));
    await expect(page.locator('#playaName')).toHaveValue(playaName, { timeout: 10_000 });
    await expect(page.locator('#phone')).toHaveValue(phone);
    await expect(page.locator('#emergencyContact')).toHaveValue(emergency);
  });

  test('blocks save when a required field is missing', async ({ page }) => {
    await page.goto(webUrl('/profile'));

    // Wait for hydration first.
    await expect(page.locator('#firstName')).toHaveValue('E2E', { timeout: 10_000 });

    // Clear a required field and try to submit.
    await page.locator('#firstName').fill('');
    await page.getByRole('button', { name: 'Save Profile' }).click();

    // ProfileForm focuses the first missing field and does NOT navigate away.
    await expect(page).toHaveURL(/#\/profile/, { timeout: 5_000 });
    await expect(page.locator('#firstName')).toBeFocused();
  });
});
