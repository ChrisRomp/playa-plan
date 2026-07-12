/**
 * Coverage:
 *  - Payment administration loads with the expected heading, filter toggle, and
 *    export button.
 *  - Registration management links preserve registration, user, and year
 *    context while recording an externally handled payment.
 *  - External payments support partial and full offline refunds, with
 *    registration status unchanged by default and updated only when selected.
 *  - PayPal portal payments explain why automated refunds are unavailable.
 */
import { test, expect } from '../helpers/fixtures';
import type { FreshAdmin } from '../helpers/fixtures';
import { getPrisma } from '../helpers/db';
import { webUrl } from '../helpers/env';

interface PaymentTestContext {
  participantId: string;
  participantEmail: string;
  registrationId: string;
  year: number;
}

function buildParticipantEmail(adminEmail: string, suffix: string): string {
  const [localPart, domain] = adminEmail.split('@');
  return `${localPart.slice(0, 48)}-${suffix}@${domain}`;
}

async function createPaymentTestContext(
  admin: FreshAdmin,
  suffix: string
): Promise<PaymentTestContext> {
  const prisma = getPrisma();
  const config = await prisma.coreConfig.findFirstOrThrow({
    orderBy: { createdAt: 'desc' },
    select: { registrationYear: true },
  });
  const participantEmail = buildParticipantEmail(admin.email, suffix);
  const participant = await prisma.user.create({
    data: {
      email: participantEmail,
      firstName: 'Payment',
      lastName: 'Participant',
      role: 'PARTICIPANT',
      isEmailVerified: true,
    },
  });
  const registration = await prisma.registration.create({
    data: {
      userId: participant.id,
      year: config.registrationYear,
      status: 'CONFIRMED',
      paymentDeferred: true,
    },
  });

  return {
    participantId: participant.id,
    participantEmail,
    registrationId: registration.id,
    year: config.registrationYear,
  };
}

function paymentAdminUrl(context: PaymentTestContext): string {
  const params = new URLSearchParams({
    registrationId: context.registrationId,
    userId: context.participantId,
    year: context.year.toString(),
  });
  return webUrl(`/admin/payments?${params.toString()}`);
}

test.describe(
  'Admin: payment administration',
  { tag: ['@admin', '@admin-payments', '@payment'] },
  () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('payment administration page loads with controls', async ({ page, freshAdmin }) => {
      await page.goto(webUrl('/admin/payments'));
      expect(freshAdmin.id).toBeTruthy();
      await expect(page.getByRole('heading', { name: 'Payment Administration' })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByRole('button', { name: 'Toggle filters' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Export payments data' })).toBeVisible();
    });

    test('admin selects a current-year registration for an external payment', async ({
      page,
      freshAdmin,
    }) => {
      const context = await createPaymentTestContext(freshAdmin, 'search');

      await page.goto(webUrl('/admin'));
      await page.getByRole('link', { name: 'Manage Payments' }).click();
      await expect(page).toHaveURL(/#\/admin\/payments$/);

      await page.getByRole('button', { name: 'Record External Payment' }).click();
      const registrationSearch = page.getByRole('searchbox', { name: 'Registration' });
      await registrationSearch.fill(context.participantEmail);
      await page.getByRole('button', { name: new RegExp(context.participantEmail) }).click();

      await expect(page.getByText(context.participantEmail)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Change registration' })).toBeVisible();
      await expect(page.getByLabel('User ID')).toHaveCount(0);
      await expect(page.getByLabel('Registration ID')).toHaveCount(0);
    });

    test('admin navigates from a registration and records an external payment', async ({
      page,
      freshAdmin,
    }) => {
      const context = await createPaymentTestContext(freshAdmin, 'external');
      const prisma = getPrisma();

      await page.goto(webUrl('/admin/manage-registrations'));
      const search = page.getByRole('textbox', { name: /filter table data|search/i });
      await search.fill(context.participantEmail);
      await expect(page.getByRole('grid').getByRole('row')).toHaveCount(2);
      const registrationRow = page.getByRole('row').filter({ hasText: context.participantEmail });
      await expect(registrationRow).toBeVisible();
      await registrationRow.getByTitle('Manage payments').click();

      await expect(page).toHaveURL(new RegExp(`registrationId=${context.registrationId}`));
      await expect(page).toHaveURL(new RegExp(`userId=${context.participantId}`));
      await expect(page).toHaveURL(new RegExp(`year=${context.year}`));

      await page.getByRole('button', { name: 'Record External Payment' }).click();
      await expect(page.getByText(context.participantEmail)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Change registration' })).toBeVisible();
      await page.getByLabel('Amount').fill('125.50');
      await page.getByLabel('External method').fill('Check');
      await page.getByLabel('Reference').fill('Check #E2E-1234');
      await page.getByRole('button', { name: 'Record payment' }).click();

      await expect(page.getByText('Check #E2E-1234')).toBeVisible();
      await expect(page.getByText('$125.50 USD')).toBeVisible();

      await expect
        .poll(async () =>
          prisma.payment.findFirst({
            where: {
              registrationId: context.registrationId,
              provider: 'MANUAL',
            },
            select: {
              amount: true,
              status: true,
              externalPaymentMethod: true,
              externalPaymentReference: true,
              recordedByUserId: true,
            },
          })
        )
        .toEqual({
          amount: 125.5,
          status: 'COMPLETED',
          externalPaymentMethod: 'Check',
          externalPaymentReference: 'Check #E2E-1234',
          recordedByUserId: freshAdmin.id,
        });

      await expect
        .poll(async () =>
          prisma.registration.findUnique({
            where: { id: context.registrationId },
            select: { paymentDeferred: true },
          })
        )
        .toEqual({ paymentDeferred: false });
    });

    test('admin records partial and full refunds for an external payment', async ({
      page,
      freshAdmin,
    }) => {
      const context = await createPaymentTestContext(freshAdmin, 'refund');
      const prisma = getPrisma();
      const payment = await prisma.payment.create({
        data: {
          amount: 100,
          currency: 'USD',
          status: 'COMPLETED',
          provider: 'MANUAL',
          externalPaymentMethod: 'Check',
          externalPaymentReference: 'Check #E2E-REFUND',
          recordedByUserId: freshAdmin.id,
          userId: context.participantId,
          registrationId: context.registrationId,
        },
      });

      await page.goto(paymentAdminUrl(context));
      await expect(page.getByText('Check #E2E-REFUND')).toBeVisible();
      await page.getByRole('button', { name: 'Refund' }).click();
      await page.getByLabel('Refund amount').fill('25.00');
      await page.getByLabel('Reason').fill('Partial camp fee adjustment');
      await page.getByRole('button', { name: 'Submit refund' }).click();

      await expect(page.getByText('PARTIALLY REFUNDED')).toBeVisible();
      await expect(page.getByText('Refunded $25.00')).toBeVisible();
      await expect
        .poll(async () =>
          prisma.registration.findUnique({
            where: { id: context.registrationId },
            select: { status: true },
          })
        )
        .toEqual({ status: 'CONFIRMED' });

      await page.getByRole('button', { name: 'Refund' }).click();
        await expect(page.getByLabel('Refund amount')).toHaveValue('');
        await page.getByLabel('Refund amount').fill('75.00');
        await page.getByLabel('Registration status change').selectOption('WAITLISTED');
      await page.getByLabel('Reason').fill('Refund remaining balance');
      await page.getByRole('button', { name: 'Submit refund' }).click();

      await expect(page.getByText('REFUNDED', { exact: true })).toBeVisible();
      await expect
        .poll(async () =>
          prisma.payment.findUnique({
            where: { id: payment.id },
            select: {
              status: true,
              refunds: {
                orderBy: { createdAt: 'asc' },
                select: {
                  amountCents: true,
                  status: true,
                  resultingRegistrationStatus: true,
                },
              },
              registration: { select: { status: true } },
            },
          })
        )
        .toEqual({
          status: 'REFUNDED',
          refunds: [
            {
              amountCents: 2500,
              status: 'SUCCEEDED',
              resultingRegistrationStatus: null,
            },
            {
              amountCents: 7500,
              status: 'SUCCEEDED',
              resultingRegistrationStatus: 'WAITLISTED',
            },
          ],
          registration: { status: 'WAITLISTED' },
        });
    });

    test('PayPal portal refunds are disabled with an explanation', async ({ page, freshAdmin }) => {
      const context = await createPaymentTestContext(freshAdmin, 'paypal');
      const prisma = getPrisma();
      await prisma.payment.create({
        data: {
          amount: 100,
          currency: 'USD',
          status: 'COMPLETED',
          provider: 'PAYPAL',
          providerRefId: 'paypal-order-e2e',
          userId: context.participantId,
          registrationId: context.registrationId,
        },
      });

      await page.goto(paymentAdminUrl(context));
      const refundButton = page.getByRole('button', { name: 'Refund' });

      await expect(refundButton).toBeDisabled();
      await expect(refundButton).toHaveAttribute(
        'title',
        'PayPal refunds must be handled outside PlayaPlan'
      );
    });
  }
);
