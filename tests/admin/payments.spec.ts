/**
 * Coverage:
 *  - Payment Reports page loads with the expected heading, filter toggle, and
 *    export button.
 *  - An admin records an external payment against a deferred registration,
 *    durably linking the payment and confirming the registration.
 *  - An admin records a partial manual refund and then refunds the remaining
 *    balance, with the ledger and payment status updated after each command.
 */
import { Locator, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { test, expect } from '../helpers/fixtures';
import { webUrl } from '../helpers/env';
import { getPrisma } from '../helpers/db';
import { loginViaUi, logoutViaUi } from '../helpers/auth';

const ADMIN_EMAIL = 'e2e-admin@test.playaplan.local';

function getPaymentRow(page: Page, email: string): Locator {
  return page
    .getByRole('heading', { name: 'Recent payments' })
    .locator('..')
    .getByRole('row')
    .filter({ hasText: email })
    .first();
}

async function loginAsAdmin(page: Page): Promise<void> {
  await logoutViaUi(page);
  await loginViaUi(page, ADMIN_EMAIL);
  await page.goto(webUrl('/admin/payments'));
  await expect(page.getByRole('heading', { name: 'Admin Payments' })).toBeVisible();
}

test.describe(
  'Admin: payments report',
  { tag: ['@admin', '@admin-payments', '@payment'] },
  () => {
    test.use({ storageState: 'tests/.auth/admin.json' });

    test('payment reports page loads with controls', async ({ page }) => {
      await page.goto(webUrl('/reports/payments'));
      await expect(page.getByRole('heading', { name: 'Payment Reports' })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByRole('button', { name: 'Toggle filters' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Export payments data' })).toBeVisible();
    });
  },
);

test.describe(
  'Admin: payment commands',
  { tag: ['@admin', '@admin-payments', '@payment'] },
  () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('records an external payment and confirms a deferred registration', async ({
      page,
      freshDeferredParticipant,
    }) => {
      const prisma = getPrisma();
      const registration = await prisma.registration.create({
        data: {
          userId: freshDeferredParticipant.id,
          year: new Date().getFullYear(),
          status: 'PENDING',
          paymentDeferred: true,
        },
      });

      await loginAsAdmin(page);
      await page.getByLabel('Registration email').fill(freshDeferredParticipant.email);
      await page.getByRole('button', { name: 'Search registrations' }).click();
      await page
        .getByRole('radio', {
          name: `Select ${freshDeferredParticipant.firstName} ${freshDeferredParticipant.lastName}`,
        })
        .check();
      await expect(
        page.getByText(
          'The registration will become CONFIRMED and payment deferral will be cleared.',
        ),
      ).toBeVisible();

      await page.getByLabel('External payment amount').fill('123.45');
      await page.getByLabel('External payment method').selectOption('CHECK');
      await page.getByLabel('External payment reference').fill('e2e-check-123');
      await page.getByLabel('Confirm external payment').check();
      await page.getByRole('button', { name: 'Record external payment' }).click();

      await expect(page.getByText('External payment recorded')).toBeVisible();
      const paymentRow = getPaymentRow(page, freshDeferredParticipant.email);
      await expect(paymentRow).toContainText('USD 123.45');
      await expect(paymentRow).toContainText('COMPLETED');
      await expect(paymentRow).toContainText('MANUAL');
      await expect(paymentRow).toContainText('CHECK');
      await expect(paymentRow).toContainText('e2e-check-123');

      const payments = await prisma.payment.findMany({
        where: { registrationId: registration.id },
      });
      expect(payments).toHaveLength(1);
      expect(payments[0]).toMatchObject({
        amount: 123.45,
        currency: 'USD',
        status: 'COMPLETED',
        provider: 'MANUAL',
        externalMethod: 'CHECK',
        externalReference: 'e2e-check-123',
        userId: freshDeferredParticipant.id,
        registrationId: registration.id,
      });

      const updatedRegistration = await prisma.registration.findUniqueOrThrow({
        where: { id: registration.id },
      });
      expect(updatedRegistration.status).toBe('CONFIRMED');
      expect(updatedRegistration.paymentDeferred).toBe(false);
    });

    test('records a partial manual refund and then refunds the remaining balance', async ({
      page,
      freshParticipant,
    }) => {
      const prisma = getPrisma();
      const registration = await prisma.registration.create({
        data: {
          userId: freshParticipant.id,
          year: new Date().getFullYear(),
          status: 'CONFIRMED',
        },
      });
      const payment = await prisma.payment.create({
        data: {
          amount: 100,
          currency: 'USD',
          status: 'COMPLETED',
          provider: 'MANUAL',
          externalMethod: 'CHECK',
          externalReference: 'e2e-original-payment',
          idempotencyKey: randomUUID(),
          userId: freshParticipant.id,
          registrationId: registration.id,
        },
      });

      await loginAsAdmin(page);
      let paymentRow = getPaymentRow(page, freshParticipant.email);
      await expect(paymentRow).toBeVisible();
      await paymentRow.getByRole('button', { name: 'Refund' }).click();

      await page.getByLabel('Partial refund amount').fill('25.00');
      await page.getByLabel('Manual refund reason').fill('Partial E2E refund');
      await page.getByLabel('Manual refund reference').fill('e2e-refund-partial');
      await page.getByRole('button', { name: 'Record manual refund' }).click();

      await expect(page.getByRole('status')).toContainText(
        'Manual refund recorded: USD 25.00.',
      );
      paymentRow = getPaymentRow(page, freshParticipant.email);
      await expect(paymentRow).toContainText('PARTIALLY_REFUNDED');
      await expect(paymentRow).toContainText('Successful: USD 25.00');
      await expect(paymentRow).toContainText('Pending: USD 0.00');
      await expect(paymentRow).toContainText('Available: USD 75.00');
      await expect(paymentRow).toContainText('USD 25.00 SUCCEEDED / MANUAL');

      await paymentRow.getByRole('button', { name: 'Refund' }).click();
      await page.getByLabel('Full available refund').check();
      await page.getByLabel('Manual refund reason').fill('Complete E2E refund');
      await page.getByLabel('Manual refund reference').fill('e2e-refund-full');
      await page.getByRole('button', { name: 'Record manual refund' }).click();

      await expect(page.getByRole('status')).toContainText(
        'Manual refund recorded: USD 75.00.',
      );
      paymentRow = getPaymentRow(page, freshParticipant.email);
      await expect(paymentRow).toContainText('REFUNDED');
      await expect(paymentRow).toContainText('Successful: USD 100.00');
      await expect(paymentRow).toContainText('Pending: USD 0.00');
      await expect(paymentRow).toContainText('Available: USD 0.00');
      await expect(paymentRow).toContainText('USD 25.00 SUCCEEDED / MANUAL');
      await expect(paymentRow).toContainText('USD 75.00 SUCCEEDED / MANUAL');
      await expect(paymentRow.getByRole('button', { name: 'Refund' })).toHaveCount(0);

      const updatedPayment = await prisma.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: { refunds: { orderBy: { createdAt: 'asc' } } },
      });
      expect(updatedPayment.status).toBe('REFUNDED');
      expect(updatedPayment.refunds).toHaveLength(2);
      expect(updatedPayment.refunds).toEqual([
        expect.objectContaining({
          amountCents: 2500,
          currency: 'USD',
          executionMode: 'MANUAL',
          status: 'SUCCEEDED',
          externalReference: 'e2e-refund-partial',
        }),
        expect.objectContaining({
          amountCents: 7500,
          currency: 'USD',
          executionMode: 'MANUAL',
          status: 'SUCCEEDED',
          externalReference: 'e2e-refund-full',
        }),
      ]);
      expect(
        updatedPayment.refunds.reduce((total, refund) => total + refund.amountCents, 0),
      ).toBe(10_000);

      const unchangedRegistration = await prisma.registration.findUniqueOrThrow({
        where: { id: registration.id },
      });
      expect(unchangedRegistration.status).toBe('CONFIRMED');
    });
  },
);
