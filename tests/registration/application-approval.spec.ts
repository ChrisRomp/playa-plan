import { RegistrationStatus } from '@prisma/client';
import { type Page } from '@playwright/test';
import { test, expect } from '../helpers/fixtures';
import { loginViaUi, logoutViaUi } from '../helpers/auth';
import { getPrisma } from '../helpers/db';
import { webUrl } from '../helpers/env';
import { waitForRegistrationProfileHydrated } from '../helpers/hydration';
import { PERSONAS } from '../helpers/personas';
import { payViaStripeCheckout } from '../helpers/stripe';

interface CoreConfigSnapshot {
  id: string;
  applicationApprovalRequired: boolean;
}

interface RegistrationSnapshot {
  id: string;
  status: RegistrationStatus;
  decisionMessage: string | null;
}

async function findLatestRegistration(userId: string): Promise<RegistrationSnapshot | null> {
  return getPrisma().registration.findFirst({
    where: { userId },
    select: {
      id: true,
      status: true,
      decisionMessage: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function snapshotCoreConfig(): Promise<CoreConfigSnapshot[]> {
  const coreConfigSnapshots = await getPrisma().coreConfig.findMany({
    select: {
      id: true,
      applicationApprovalRequired: true,
    },
  });

  if (coreConfigSnapshots.length === 0) {
    throw new Error('Expected at least one coreConfig row for application approval tests.');
  }

  return coreConfigSnapshots;
}

async function setApplicationApprovalRequired(value: boolean): Promise<void> {
  await getPrisma().coreConfig.updateMany({
    data: { applicationApprovalRequired: value },
  });
}

async function restoreCoreConfigSnapshots(coreConfigSnapshots: CoreConfigSnapshot[]): Promise<void> {
  await Promise.all(
    coreConfigSnapshots.map(async (coreConfigSnapshot) =>
      getPrisma().coreConfig.update({
        where: { id: coreConfigSnapshot.id },
        data: {
          applicationApprovalRequired: coreConfigSnapshot.applicationApprovalRequired,
        },
      }),
    ),
  );
}

async function withApplicationApprovalEnabled<T>(action: () => Promise<T>): Promise<T> {
  const coreConfigSnapshots = await snapshotCoreConfig();
  await setApplicationApprovalRequired(true);

  try {
    return await action();
  } finally {
    await restoreCoreConfigSnapshots(coreConfigSnapshots);
  }
}

async function submitApplication(page: Page): Promise<void> {
  await page.goto(webUrl('/registration'));
  await expect(page.getByRole('heading', { name: 'Camp Application' })).toBeVisible({
    timeout: 10_000,
  });

  await waitForRegistrationProfileHydrated(page);
  await page.getByRole('textbox', { name: 'Phone Number*' }).fill('555-0100');
  await page
    .getByRole('textbox', { name: 'Emergency Contact(s)*' })
    .fill('E2E Contact, 555-0199, friend');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Select Camping Options' })).toBeVisible();
  await page.getByRole('checkbox', { name: /Skydiving/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Additional Information' })).toBeVisible();

  const spinbuttonByLabel = (label: string | RegExp) =>
    page
      .getByText(label, { exact: false })
      .locator('xpath=ancestor::div[1]')
      .getByRole('spinbutton');

  await spinbuttonByLabel(/how many skydives have you done in total/i).fill('200');
  await spinbuttonByLabel(/how many skydives have you done in the last 6 months/i).fill('20');
  await spinbuttonByLabel(/total years jumping with burning sky/i).fill('3');
  await page.getByRole('button', { name: 'Submit Application' }).click();
}

async function selectFirstAvailableCampShift(page: Page): Promise<void> {
  const categoryButtons = page.getByRole('button', { name: /\(\d+ shifts?\)/ });
  const count = await categoryButtons.count();

  for (let i = 0; i < count; i += 1) {
    const category = categoryButtons.nth(i);
    await category.click();

    const roomyShift = page
      .getByRole('checkbox', { name: /Spots: ([2-9]|\d{2,}) of \d+ available/ })
      .first();

    if (await roomyShift.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await roomyShift.check();
      return;
    }

    await category.click();
  }

  throw new Error('No camp shift with at least two available spots was found.');
}

async function selectTeardownShift(page: Page): Promise<void> {
  const teardownCategory = page.getByRole('button', { name: /Teardown\*/ });
  const teardownCheckboxes = page.getByRole('checkbox', { name: /Teardown/ });

  if ((await teardownCheckboxes.count()) === 0 && (await teardownCategory.isVisible().catch(() => false))) {
    await teardownCategory.click();
  }

  await page.getByRole('checkbox', { name: /Teardown Morning/ }).check();
}

async function advanceApprovedRegistrationToPayment(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Select Work Shifts' })).toBeVisible({
    timeout: 15_000,
  });
  await selectFirstAvailableCampShift(page);
  await selectTeardownShift(page);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Review & Accept Terms' })).toBeVisible();
  await page.getByRole('checkbox', { name: /i accept the terms/i }).check();
  await page.getByRole('button', { name: 'Review & Pay' }).click();

  await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /Complete Registration/ })).toBeVisible();
}

async function loginAsAdmin(page: Page): Promise<void> {
  await logoutViaUi(page);
  await loginViaUi(page, PERSONAS.admin.email);
}

async function loginAsParticipant(page: Page, email: string): Promise<void> {
  await logoutViaUi(page);
  await loginViaUi(page, email);
}

async function openApplicationsPage(page: Page, applicantEmail: string): Promise<void> {
  await page.goto(webUrl('/admin/applications'));
  await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible({ timeout: 10_000 });

  const searchInput = page.getByPlaceholder('Search by applicant name or email');
  await searchInput.fill(applicantEmail);
  await expect(page.locator('tbody tr').filter({ hasText: applicantEmail }).first()).toBeVisible({
    timeout: 10_000,
  });
}

async function approveApplicationAsAdmin(page: Page, applicantEmail: string): Promise<void> {
  await loginAsAdmin(page);
  await openApplicationsPage(page, applicantEmail);

  const applicationRow = page.locator('tbody tr').filter({ hasText: applicantEmail }).first();
  await applicationRow.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Application approved.')).toBeVisible({ timeout: 10_000 });
}

async function declineApplicationAsAdmin(
  page: Page,
  applicantEmail: string,
  message: string,
): Promise<void> {
  await loginAsAdmin(page);
  await openApplicationsPage(page, applicantEmail);

  const applicationRow = page.locator('tbody tr').filter({ hasText: applicantEmail }).first();
  await applicationRow.getByRole('button', { name: 'Decline' }).click();
  await page.getByLabel('Decline message').fill(message);
  await page.getByRole('button', { name: /^Decline Application$/ }).click();
  await expect(page.getByText('Application declined.')).toBeVisible({ timeout: 10_000 });
}

test.describe(
  'Application Approval Workflow',
  { tag: ['@registration', '@approval', '@slow'] },
  () => {
    test.describe.configure({ mode: 'serial' });
    test.use({ storageState: { cookies: [], origins: [] } });

    test('participant submits application and sees pending status', async ({
      page,
      freshParticipant,
    }) => {
      test.setTimeout(60_000);

      await withApplicationApprovalEnabled(async () => {
        await submitApplication(page);

        await expect(page.getByRole('heading', { name: /application pending review/i })).toBeVisible({
          timeout: 10_000,
        });
        await expect(page.getByText(/there is nothing else to do right now/i)).toBeVisible();

        await expect.poll(async () => (await findLatestRegistration(freshParticipant.id))?.status ?? null).toBe(
          RegistrationStatus.APPLICATION_SUBMITTED,
        );
      });
    });

    test('admin approves a submitted application', async ({ page, freshParticipant }) => {
      test.setTimeout(90_000);

      await withApplicationApprovalEnabled(async () => {
        await submitApplication(page);
        await expect.poll(async () => (await findLatestRegistration(freshParticipant.id))?.status ?? null).toBe(
          RegistrationStatus.APPLICATION_SUBMITTED,
        );

        await approveApplicationAsAdmin(page, freshParticipant.email);
      });

      await expect.poll(async () => (await findLatestRegistration(freshParticipant.id))?.status ?? null).toBe(
        RegistrationStatus.APPLICATION_APPROVED,
      );
    });

    test('participant completes registration after approval', async ({ page, freshParticipant }) => {
      test.setTimeout(120_000);

      await withApplicationApprovalEnabled(async () => {
        await submitApplication(page);
        await approveApplicationAsAdmin(page, freshParticipant.email);
        await loginAsParticipant(page, freshParticipant.email);
        await page.goto(webUrl('/registration'));

        await expect(page.getByRole('heading', { name: 'Select Work Shifts' })).toBeVisible({
          timeout: 15_000,
        });
        await expect(page.getByText('Application approved')).toBeVisible();
      });

      // Verify step indicator only shows completion steps (not application steps).
      // Scope to the main content area to avoid matching nav links.
      const main = page.locator('main, .max-w-3xl').first();
      await expect(main.getByText('Profile', { exact: true })).toHaveCount(0);
      await expect(main.getByText('Options', { exact: true })).toHaveCount(0);
      await expect(main.getByText('Details', { exact: true })).toHaveCount(0);
      await expect(main.getByText('Shifts', { exact: true })).toBeVisible();
      await expect(main.getByText('Review', { exact: true })).toBeVisible();
      await expect(main.getByText('Payment', { exact: true })).toBeVisible();

      await advanceApprovedRegistrationToPayment(page);
      await page.getByRole('button', { name: /Complete Registration/ }).click();
      await payViaStripeCheckout(page, { card: 'success' });

      await expect(page).toHaveURL(/#\/payment\/success/, { timeout: 30_000 });
      await expect(page.getByRole('heading', { name: /payment successful/i })).toBeVisible({
        timeout: 10_000,
      });

      await expect
        .poll(async () => {
          const status = (await findLatestRegistration(freshParticipant.id))?.status ?? null;
          return status === RegistrationStatus.PENDING || status === RegistrationStatus.CONFIRMED;
        })
        .toBe(true);

      const registration = await findLatestRegistration(freshParticipant.id);
      expect(registration).not.toBeNull();
      expect([RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED]).toContain(
        registration!.status,
      );
    });

    test('admin declines an application and participant sees the decline state', async ({
      page,
      freshParticipant,
    }) => {
      test.setTimeout(90_000);

      await withApplicationApprovalEnabled(async () => {
        await submitApplication(page);

        const declineMessage = 'We do not have capacity to approve this application right now.';
        await declineApplicationAsAdmin(page, freshParticipant.email, declineMessage);

        await expect.poll(async () => (await findLatestRegistration(freshParticipant.id))?.status ?? null).toBe(
          RegistrationStatus.APPLICATION_DECLINED,
        );

        const registration = await findLatestRegistration(freshParticipant.id);
        expect(registration?.decisionMessage).toBe(declineMessage);

        await loginAsParticipant(page, freshParticipant.email);
        await page.goto(webUrl('/registration'));

        await expect(page.getByRole('heading', { name: /application not approved/i })).toBeVisible({
          timeout: 10_000,
        });
        await expect(page.getByText(/your application was not approved/i)).toBeVisible();
        await expect(page.getByText(declineMessage)).toBeVisible();
      });
    });

    test('auto-approved participant skips the pending review wait', async ({
      page,
      freshParticipant,
    }) => {
      test.setTimeout(120_000);

      await getPrisma().user.update({
        where: { id: freshParticipant.id },
        data: { autoApproveRegistration: true },
      });

      await withApplicationApprovalEnabled(async () => {
        await submitApplication(page);

        await expect(page.getByRole('heading', { name: 'Select Work Shifts' })).toBeVisible({
          timeout: 15_000,
        });
        await expect(page.getByText('Application approved')).toBeVisible();
        await expect(page.getByText(/complete your registration below/i)).toBeVisible();
        await expect.poll(async () => (await findLatestRegistration(freshParticipant.id))?.status ?? null).toBe(
          RegistrationStatus.APPLICATION_APPROVED,
        );
      });

      await advanceApprovedRegistrationToPayment(page);
      await page.getByRole('button', { name: /Complete Registration/ }).click();
      await payViaStripeCheckout(page, { card: 'success' });

      await expect(page).toHaveURL(/#\/payment\/success/, { timeout: 30_000 });
      await expect
        .poll(async () => {
          const status = (await findLatestRegistration(freshParticipant.id))?.status ?? null;
          return status === RegistrationStatus.PENDING || status === RegistrationStatus.CONFIRMED;
        })
        .toBe(true);
    });
  },
);
