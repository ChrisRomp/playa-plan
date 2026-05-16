/**
 * Coverage:
 *  - Stripe declined card on Checkout shows the inline decline message; user is
 *    not redirected back to the app and no Payment row is created.
 *  - Required custom field missing on the Details step blocks Continue.
 *  - Terms not accepted on the Review step blocks the Review & Pay button.
 */
import { test, expect } from '../helpers/fixtures';
import { walkRegistrationToPayment } from '../helpers/registration';
import {
  fillStripeCheckoutForm,
  submitStripePayment,
  expectStripeDecline,
} from '../helpers/stripe';
import { getPrisma } from '../helpers/db';
import { webUrl } from '../helpers/env';
import { waitForRegistrationProfileHydrated } from '../helpers/hydration';

test.describe(
  'Registration: failure paths',
  { tag: ['@registration', '@payment', '@slow'] },
  () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('Stripe declined card surfaces an error and does not create a payment', async ({
      page,
      freshParticipant,
    }) => {
      test.setTimeout(120_000);
      await walkRegistrationToPayment(page);
      await page.getByRole('button', { name: /Complete Registration/ }).click();

      await fillStripeCheckoutForm(page, { card: 'genericDecline' });
      await submitStripePayment(page);
      await expectStripeDecline(page);

      // Backend assertions: the registration was created (Stripe Checkout flows
      // create the row before redirecting), but no COMPLETED payment exists.
      const prisma = getPrisma();
      const reg = await prisma.registration.findFirst({
        where: { userId: freshParticipant.id },
        include: { payments: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(reg).not.toBeNull();
      const completed = reg!.payments.filter((p) => p.status === 'COMPLETED');
      expect(completed).toHaveLength(0);
    });

    test('missing required custom field blocks Continue on the Details step', async ({
      page,
      freshParticipant,
    }) => {
      expect(freshParticipant.email).toContain('@test.playaplan.local');
      await page.goto(webUrl('/registration'));
      await waitForRegistrationProfileHydrated(page);
      await page.getByRole('textbox', { name: 'Phone Number*' }).fill('555-0100');
      await page
        .getByRole('textbox', { name: 'Emergency Contact(s)*' })
        .fill('E2E Contact, 555-0199, friend');
      await page.getByRole('button', { name: 'Continue' }).click();

      await page.getByRole('checkbox', { name: /Skydiving/ }).check();
      await page.getByRole('button', { name: 'Continue' }).click();

      // Click Continue without filling the required spinbuttons.
      await expect(page.getByRole('heading', { name: 'Additional Information' })).toBeVisible();
      await page.getByRole('button', { name: 'Continue' }).click();

      // Should stay on the Details step (Shifts heading must NOT appear).
      await expect(page.getByRole('heading', { name: 'Select Work Shifts' })).toBeHidden({
        timeout: 3_000,
      });
      await expect(page.getByText(/is required/i).first()).toBeVisible();
    });

    test('unaccepted terms blocks the Review & Pay button', async ({
      page,
      freshParticipant,
    }) => {
      expect(freshParticipant.email).toContain('@test.playaplan.local');
      await walkRegistrationToPayment(page);
      // walkRegistrationToPayment accepts the terms — back up to Review and uncheck.
      await page.getByRole('button', { name: 'Back' }).click();
      await expect(page.getByRole('heading', { name: 'Review & Accept Terms' })).toBeVisible();
      await page.getByRole('checkbox', { name: /i accept the terms/i }).uncheck();
      await page.getByRole('button', { name: /Review & Pay|Submit/ }).click();

      // Should remain on Review (Payment heading must NOT appear).
      await expect(page.getByRole('heading', { name: 'Payment' })).toBeHidden({ timeout: 3_000 });
      await expect(page.getByRole('heading', { name: 'Review & Accept Terms' })).toBeVisible();
    });
  },
);
