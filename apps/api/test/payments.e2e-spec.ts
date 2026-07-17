import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PaymentProvider,
  PaymentRefundStatus,
  PaymentStatus,
  RefundExecutionMode,
  RegistrationStatus,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { StripeService } from '../src/payments/services/stripe.service';

interface StripeServiceMock {
  readonly createAdminRefund: jest.MockedFunction<StripeService['createAdminRefund']>;
  readonly findAdminRefund: jest.MockedFunction<StripeService['findAdminRefund']>;
}

describe('Admin payment refunds (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let adminUserId: string;
  let participantUserId: string;
  let registrationId: string;

  const suiteId = randomUUID();
  const stripeServiceMock: StripeServiceMock = {
    createAdminRefund: jest.fn<StripeService['createAdminRefund']>(),
    findAdminRefund: jest.fn<StripeService['findAdminRefund']>(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StripeService)
      .useValue(stripeServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    const jwtService = app.get(JwtService);
    const admin = await prisma.user.create({
      data: {
        email: `payments-admin-${suiteId}@e2e.test`,
        firstName: 'Payments',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        isEmailVerified: true,
      },
    });
    const participant = await prisma.user.create({
      data: {
        email: `payments-participant-${suiteId}@e2e.test`,
        firstName: 'Payments',
        lastName: 'Participant',
        role: UserRole.PARTICIPANT,
        isEmailVerified: true,
      },
    });
    const registration = await prisma.registration.create({
      data: {
        userId: participant.id,
        year: new Date().getFullYear(),
        status: RegistrationStatus.CONFIRMED,
      },
    });

    adminUserId = admin.id;
    participantUserId = participant.id;
    registrationId = registration.id;
    adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });
  });

  beforeEach(() => {
    stripeServiceMock.createAdminRefund.mockReset();
    stripeServiceMock.findAdminRefund.mockReset();
  });

  afterEach(async () => {
    await prisma.adminAudit.deleteMany({ where: { adminUserId } });
    await prisma.paymentRefund.deleteMany({ where: { processedByUserId: adminUserId } });
    await prisma.payment.deleteMany({ where: { userId: participantUserId } });
  });

  afterAll(async () => {
    await prisma.registration.delete({ where: { id: registrationId } });
    await prisma.user.deleteMany({
      where: { id: { in: [adminUserId, participantUserId] } },
    });
    await app.close();
  });

  async function createStripePayment(providerRefId: string) {
    return prisma.payment.create({
      data: {
        amount: 100,
        currency: 'USD',
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.STRIPE,
        providerRefId,
        userId: participantUserId,
        registrationId,
      },
    });
  }

  it('should persist a successful Stripe refund through the HTTP endpoint', async () => {
    const payment = await createStripePayment('pi_e2e_immediate_success');
    const idempotencyKey = randomUUID();
    const providerRefundId = `re_${suiteId}_immediate`;
    stripeServiceMock.createAdminRefund.mockResolvedValueOnce({
      outcome: 'SUCCEEDED',
      providerRefundId,
    });

    const response = await request(app.getHttpServer())
      .post(`/payments/${payment.id}/refunds`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amountCents: 2500,
        executionMode: RefundExecutionMode.STRIPE,
        reason: 'Immediate success E2E',
        idempotencyKey,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      outcome: 'SUCCEEDED',
      paymentAmountCents: 10_000,
      successfulRefundCents: 2500,
      pendingRefundCents: 0,
      availableRefundCents: 7500,
      payment: { id: payment.id, status: PaymentStatus.PARTIALLY_REFUNDED },
      refund: {
        amountCents: 2500,
        currency: 'USD',
        executionMode: RefundExecutionMode.STRIPE,
        status: PaymentRefundStatus.SUCCEEDED,
      },
    });
    expect(stripeServiceMock.createAdminRefund).toHaveBeenCalledWith({
      providerRefId: payment.providerRefId,
      amountCents: 2500,
      idempotencyKey,
      localRefundId: response.body.refund.id,
    });

    const persistedPayment = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: { refunds: true },
    });
    expect(persistedPayment.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
    expect(persistedPayment.refunds).toEqual([
      expect.objectContaining({
        id: response.body.refund.id,
        amountCents: 2500,
        status: PaymentRefundStatus.SUCCEEDED,
        providerRefundId,
        idempotencyKey,
      }),
    ]);
  });

  it('should recover an ambiguous Stripe refund on retry without a duplicate ledger row', async () => {
    const payment = await createStripePayment('pi_e2e_ambiguous_retry');
    const idempotencyKey = randomUUID();
    const providerRefundId = `re_${suiteId}_retry`;
    stripeServiceMock.createAdminRefund
      .mockResolvedValueOnce({ outcome: 'PENDING_UNKNOWN' })
      .mockResolvedValueOnce({
        outcome: 'SUCCEEDED',
        providerRefundId,
      });
    stripeServiceMock.findAdminRefund.mockResolvedValueOnce({ outcome: 'NOT_FOUND' });

    const pendingResponse = await request(app.getHttpServer())
      .post(`/payments/${payment.id}/refunds`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amountCents: 4000,
        executionMode: RefundExecutionMode.STRIPE,
        reason: 'Ambiguous retry E2E',
        idempotencyKey,
      })
      .expect(201);

    expect(pendingResponse.body).toMatchObject({
      outcome: 'PENDING_UNKNOWN',
      successfulRefundCents: 0,
      pendingRefundCents: 4000,
      availableRefundCents: 6000,
      payment: { id: payment.id, status: PaymentStatus.COMPLETED },
      refund: {
        amountCents: 4000,
        status: PaymentRefundStatus.PENDING,
      },
    });
    const refundId = pendingResponse.body.refund.id as string;

    const pendingRows = await prisma.paymentRefund.findMany({
      where: { paymentId: payment.id },
    });
    expect(pendingRows).toHaveLength(1);
    expect(pendingRows[0]).toMatchObject({
      id: refundId,
      status: PaymentRefundStatus.PENDING,
      idempotencyKey,
    });

    const retryResponse = await request(app.getHttpServer())
      .post(`/payments/${payment.id}/refunds/${refundId}/retry`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send()
      .expect(201);

    expect(retryResponse.body).toMatchObject({
      outcome: 'SUCCEEDED',
      successfulRefundCents: 4000,
      pendingRefundCents: 0,
      availableRefundCents: 6000,
      payment: { id: payment.id, status: PaymentStatus.PARTIALLY_REFUNDED },
      refund: {
        id: refundId,
        amountCents: 4000,
        status: PaymentRefundStatus.SUCCEEDED,
      },
    });
    expect(stripeServiceMock.findAdminRefund).toHaveBeenCalledWith(
      payment.providerRefId,
      refundId,
    );
    expect(stripeServiceMock.createAdminRefund).toHaveBeenCalledTimes(2);
    expect(stripeServiceMock.createAdminRefund.mock.calls[1][0]).toEqual(
      stripeServiceMock.createAdminRefund.mock.calls[0][0],
    );

    const persistedRefunds = await prisma.paymentRefund.findMany({
      where: { paymentId: payment.id },
    });
    expect(persistedRefunds).toHaveLength(1);
    expect(persistedRefunds[0]).toMatchObject({
      id: refundId,
      amountCents: 4000,
      status: PaymentRefundStatus.SUCCEEDED,
      providerRefundId,
      idempotencyKey,
    });
  });
});
