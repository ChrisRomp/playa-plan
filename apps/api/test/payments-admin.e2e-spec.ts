import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import {
  PaymentProvider,
  PaymentStatus,
  RegistrationStatus,
  UserRole,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Admin payments (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let participantToken: string;
  let adminUserId: string;
  let participantUserId: string;
  let registrationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    await app.init();
    await cleanDatabase();
    await createTestData();
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  async function cleanDatabase(): Promise<void> {
    await prismaService.paymentRefund.deleteMany();
    await prismaService.adminAudit.deleteMany();
    await prismaService.emailAudit.deleteMany();
    await prismaService.payment.deleteMany();
    await prismaService.registration.deleteMany();
    await prismaService.user.deleteMany();
    await prismaService.coreConfig.deleteMany();
  }

  async function createTestData(): Promise<void> {
    const admin = await prismaService.user.create({
      data: {
        email: 'payments-admin-e2e@example.com',
        password: 'hashed-password',
        firstName: 'Payments',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        isEmailVerified: true,
      },
    });

    const participant = await prismaService.user.create({
      data: {
        email: 'payments-participant-e2e@example.com',
        password: 'hashed-password',
        firstName: 'Payments',
        lastName: 'Participant',
        role: UserRole.PARTICIPANT,
        isEmailVerified: true,
      },
    });

    const registration = await prismaService.registration.create({
      data: {
        userId: participant.id,
        year: 2026,
        status: RegistrationStatus.CONFIRMED,
        paymentDeferred: true,
      },
    });

    await prismaService.coreConfig.create({
      data: {
        campName: 'Payments E2E Camp',
        registrationYear: 2026,
        emailEnabled: false,
        senderEmail: 'test@example.com',
        senderName: 'Payments E2E Camp',
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
    participantToken = jwtService.sign({
      sub: participant.id,
      email: participant.email,
      role: participant.role,
    });
  }

  it('records an externally handled payment and returns it in the admin overview', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/payments/manual')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amount: 125.5,
        currency: 'USD',
        userId: participantUserId,
        registrationId,
        externalPaymentMethod: 'Check',
        reference: 'Check #1234',
      })
      .expect(201);

    expect(createResponse.body.provider).toBe(PaymentProvider.MANUAL);
    expect(createResponse.body.externalPaymentMethod).toBe('Check');
    expect(createResponse.body.externalPaymentReference).toBe('Check #1234');
    expect(createResponse.body.recordedByUserId).toBe(adminUserId);

    const registration = await prismaService.registration.findUniqueOrThrow({
      where: { id: registrationId },
    });
    expect(registration.paymentDeferred).toBe(false);

    const listResponse = await request(app.getHttpServer())
      .get(`/payments?registrationId=${registrationId}&provider=MANUAL&year=2026`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(listResponse.body.payments).toHaveLength(1);
    expect(listResponse.body.payments[0]).toMatchObject({
      id: createResponse.body.id,
      provider: PaymentProvider.MANUAL,
      status: PaymentStatus.COMPLETED,
      refundedAmount: 0,
      netAmount: 125.5,
      refundableAmount: 125.5,
      processorRefundAvailable: false,
    });
  });

  it('records partial and full manual refunds without changing registration status unless requested', async () => {
    const payment = await prismaService.payment.create({
      data: {
        amount: 125.5,
        currency: 'USD',
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.MANUAL,
        userId: participantUserId,
        registrationId,
        externalPaymentMethod: 'Check',
        externalPaymentReference: 'Refund test payment',
        recordedByUserId: adminUserId,
      },
    });

    const partialRefundResponse = await request(app.getHttpServer())
      .post('/payments/refund')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        paymentId: payment.id,
        amount: 25,
        reason: 'Partial fee adjustment',
      })
      .expect(201);

    expect(partialRefundResponse.body).toMatchObject({
      paymentId: payment.id,
      refundAmount: 25,
      success: true,
    });

    const registrationAfterPartialRefund = await prismaService.registration.findUniqueOrThrow({
      where: { id: registrationId },
    });
    expect(registrationAfterPartialRefund.status).toBe(RegistrationStatus.CONFIRMED);

    const partiallyRefundedOverview = await request(app.getHttpServer())
      .get(`/payments?registrationId=${registrationId}&status=PARTIALLY_REFUNDED`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(partiallyRefundedOverview.body.payments).toHaveLength(1);
    expect(partiallyRefundedOverview.body.payments[0]).toMatchObject({
      id: payment.id,
      status: PaymentStatus.PARTIALLY_REFUNDED,
      refundedAmount: 25,
      netAmount: 100.5,
      refundableAmount: 100.5,
    });

    await request(app.getHttpServer())
      .post('/payments/refund')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        paymentId: payment.id,
        amount: 100.5,
        reason: 'Full remaining refund',
        resultingRegistrationStatus: RegistrationStatus.WAITLISTED,
      })
      .expect(201);

    const fullyRefundedPayment = await prismaService.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    const updatedRegistration = await prismaService.registration.findUniqueOrThrow({
      where: { id: registrationId },
    });

    expect(fullyRefundedPayment.status).toBe(PaymentStatus.REFUNDED);
    expect(updatedRegistration.status).toBe(RegistrationStatus.WAITLISTED);
    await expect(
      prismaService.paymentRefund.count({ where: { paymentId: payment.id } }),
    ).resolves.toBe(2);
  });

  it('denies participant access to payment admin mutations', async () => {
    await request(app.getHttpServer())
      .post('/payments/manual')
      .set('Authorization', `Bearer ${participantToken}`)
      .send({
        amount: 10,
        userId: participantUserId,
        registrationId,
      })
      .expect(403);

    await request(app.getHttpServer())
      .post('/payments/refund')
      .set('Authorization', `Bearer ${participantToken}`)
      .send({
        paymentId: registrationId,
        amount: 10,
      })
      .expect(403);
  });
});
