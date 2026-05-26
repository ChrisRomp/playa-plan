import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { DayOfWeek, RegistrationStatus, UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

const TEST_PASSWORD = 'hashed_password';
const TEST_SENDER_EMAIL = 'application-approval@test.playaplan.app';
const TEST_SENDER_NAME = 'Application Approval E2E';
const TEST_RUN_ID = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const TEST_YEAR = new Date().getFullYear() + 5;

interface AuthenticatedTestUser {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
  readonly token: string;
}

interface CreateTestUserInput {
  readonly label: string;
  readonly role: UserRole;
  readonly autoApproveRegistration?: boolean;
  readonly allowRegistration?: boolean;
  readonly allowEarlyRegistration?: boolean;
  readonly allowDeferredDuesPayment?: boolean;
  readonly allowNoJob?: boolean;
}

interface CoreConfigSnapshot {
  readonly id: string;
  readonly campName: string;
  readonly registrationYear: number;
  readonly registrationOpen: boolean;
  readonly earlyRegistrationOpen: boolean;
  readonly allowDeferredDuesPayment: boolean;
  readonly emailEnabled: boolean;
  readonly senderEmail: string | null;
  readonly senderName: string | null;
  readonly applicationApprovalRequired: boolean;
}

describe('Application Approval Workflow (Integration Tests)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  let adminUser: AuthenticatedTestUser;
  let staffUser: AuthenticatedTestUser;
  let participantUser: AuthenticatedTestUser;
  let autoApprovedParticipantUser: AuthenticatedTestUser;

  let testCoreConfigId = '';
  let originalCoreConfig: CoreConfigSnapshot | null = null;
  let coreConfigCreatedByTest = false;

  let testCampingOptionId = '';
  let testShiftId = '';
  let testJobCategoryId = '';
  let testJobId = '';

  const createdUserIds: string[] = [];
  const createdUserEmails: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    await app.init();
    await setupCoreConfig();
    await createSupportData();

    adminUser = await createAuthenticatedUser({
      label: 'admin',
      role: UserRole.ADMIN,
    });
    staffUser = await createAuthenticatedUser({
      label: 'staff',
      role: UserRole.STAFF,
    });
    participantUser = await createAuthenticatedUser({
      label: 'participant',
      role: UserRole.PARTICIPANT,
    });
    autoApprovedParticipantUser = await createAuthenticatedUser({
      label: 'auto-approved',
      role: UserRole.PARTICIPANT,
      autoApproveRegistration: true,
    });
  });

  beforeEach(async () => {
    await updateTestCoreConfig({ applicationApprovalRequired: true });
  });

  afterAll(async () => {
    await cleanupTestData();
    await restoreCoreConfig();
    await app.close();
  });

  it('should submit an application and persist it in the database', async () => {
    const response = await request(app.getHttpServer())
      .post('/registrations/apply')
      .set('Authorization', `Bearer ${participantUser.token}`)
      .send(buildApplicationPayload())
      .expect(201);

    expect(response.body.registration.status).toBe(RegistrationStatus.APPLICATION_SUBMITTED);
    expect(response.body.campingOptionRegistrations).toHaveLength(1);

    const actualRegistration = await prismaService.registration.findUniqueOrThrow({
      where: { id: response.body.registration.id },
      include: {
        campingOptionRegistrations: true,
      },
    });

    expect(actualRegistration.userId).toBe(participantUser.id);
    expect(actualRegistration.year).toBe(TEST_YEAR);
    expect(actualRegistration.status).toBe(RegistrationStatus.APPLICATION_SUBMITTED);
    expect(actualRegistration.campingOptionRegistrations).toHaveLength(1);
  });

  it('should auto-approve an application submitted by staff', async () => {
    const response = await request(app.getHttpServer())
      .post('/registrations/apply')
      .set('Authorization', `Bearer ${staffUser.token}`)
      .send(buildApplicationPayload())
      .expect(201);

    expect(response.body.registration.status).toBe(RegistrationStatus.APPLICATION_APPROVED);
  });

  it('should auto-approve an application submitted by an auto-approved participant', async () => {
    const response = await request(app.getHttpServer())
      .post('/registrations/apply')
      .set('Authorization', `Bearer ${autoApprovedParticipantUser.token}`)
      .send(buildApplicationPayload())
      .expect(201);

    expect(response.body.registration.status).toBe(RegistrationStatus.APPLICATION_APPROVED);
  });

  it('should block duplicate application submissions for the same participant', async () => {
    const duplicateUser = await createAuthenticatedUser({
      label: 'duplicate-participant',
      role: UserRole.PARTICIPANT,
    });

    await request(app.getHttpServer())
      .post('/registrations/apply')
      .set('Authorization', `Bearer ${duplicateUser.token}`)
      .send(buildApplicationPayload())
      .expect(201);

    await request(app.getHttpServer())
      .post('/registrations/apply')
      .set('Authorization', `Bearer ${duplicateUser.token}`)
      .send(buildApplicationPayload())
      .expect(409);
  });

  it('should reject application submission when application approval mode is disabled', async () => {
    await updateTestCoreConfig({ applicationApprovalRequired: false });

    const disabledUser = await createAuthenticatedUser({
      label: 'feature-disabled',
      role: UserRole.PARTICIPANT,
    });

    const response = await request(app.getHttpServer())
      .post('/registrations/apply')
      .set('Authorization', `Bearer ${disabledUser.token}`)
      .send(buildApplicationPayload())
      .expect(400);

    expect(response.body.message).toBe('Application mode is not enabled');
  });

  it('should list submitted applications for admin users', async () => {
    const submittedApplication = await createSubmittedApplication('list-applications');

    const response = await request(app.getHttpServer())
      .get(
        `/admin/applications?year=${TEST_YEAR}&search=${encodeURIComponent(submittedApplication.user.email)}`
      )
      .set('Authorization', `Bearer ${adminUser.token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      total: expect.any(Number),
      page: 1,
      limit: 20,
    });
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: submittedApplication.registrationId,
          status: RegistrationStatus.APPLICATION_SUBMITTED,
        }),
      ])
    );
  });

  it('should forbid participants from listing applications', async () => {
    await request(app.getHttpServer())
      .get('/admin/applications')
      .set('Authorization', `Bearer ${participantUser.token}`)
      .expect(403);
  });

  it('should approve a submitted application and record review metadata', async () => {
    const submittedApplication = await createSubmittedApplication('approve-application');

    const response = await request(app.getHttpServer())
      .patch(`/admin/applications/${submittedApplication.registrationId}/approve`)
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({ message: 'Approved for camp' })
      .expect(200);

    expect(response.body.status).toBe(RegistrationStatus.APPLICATION_APPROVED);

    const actualRegistration = await prismaService.registration.findUniqueOrThrow({
      where: { id: submittedApplication.registrationId },
    });

    expect(actualRegistration.status).toBe(RegistrationStatus.APPLICATION_APPROVED);
    expect(actualRegistration.reviewedById).toBe(adminUser.id);
    expect(actualRegistration.reviewedAt).not.toBeNull();
  });

  it('should decline a submitted application and store the decision message', async () => {
    const submittedApplication = await createSubmittedApplication('decline-application');
    const inputMessage = 'Camp is currently full.';

    const response = await request(app.getHttpServer())
      .patch(`/admin/applications/${submittedApplication.registrationId}/decline`)
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({ message: inputMessage })
      .expect(200);

    expect(response.body.status).toBe(RegistrationStatus.APPLICATION_DECLINED);

    const actualRegistration = await prismaService.registration.findUniqueOrThrow({
      where: { id: submittedApplication.registrationId },
    });

    expect(actualRegistration.status).toBe(RegistrationStatus.APPLICATION_DECLINED);
    expect(actualRegistration.decisionMessage).toBe(inputMessage);
  });

  it('should require a message when declining an application', async () => {
    const submittedApplication = await createSubmittedApplication('decline-without-message');

    await request(app.getHttpServer())
      .patch(`/admin/applications/${submittedApplication.registrationId}/decline`)
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({})
      .expect(400);
  });

  it('should complete registration after application approval', async () => {
    const approvedApplication = await createApplicationForNewUser('complete-approved', {
      role: UserRole.PARTICIPANT,
      autoApproveRegistration: true,
    });

    const response = await request(app.getHttpServer())
      .post('/registrations/complete')
      .set('Authorization', `Bearer ${approvedApplication.user.token}`)
      .send(buildCompleteRegistrationPayload())
      .expect(201);

    expect(response.body.registration.status).toBe(RegistrationStatus.PENDING);

    const actualRegistration = await prismaService.registration.findUniqueOrThrow({
      where: { id: approvedApplication.registrationId },
      include: {
        jobs: true,
      },
    });

    expect(actualRegistration.status).toBe(RegistrationStatus.PENDING);
    expect(actualRegistration.jobs).toHaveLength(1);
    expect(actualRegistration.jobs[0].jobId).toBe(testJobId);
  });

  it('should reject registration completion before an application is approved', async () => {
    const submittedApplication = await createSubmittedApplication('complete-not-approved');

    await request(app.getHttpServer())
      .post('/registrations/complete')
      .set('Authorization', `Bearer ${submittedApplication.user.token}`)
      .send(buildCompleteRegistrationPayload())
      .expect(404);
  });

  it('should bulk approve submitted applications', async () => {
    const firstApplication = await createSubmittedApplication('bulk-approve-one');
    const secondApplication = await createSubmittedApplication('bulk-approve-two');

    const response = await request(app.getHttpServer())
      .patch('/admin/applications/bulk')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({
        ids: [firstApplication.registrationId, secondApplication.registrationId],
        action: 'approve',
      })
      .expect(200);

    expect(response.body.processed).toBe(2);
    expect(response.body.skipped).toBe(0);
    expect(response.body.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: firstApplication.registrationId,
          status: 'approved',
        }),
        expect.objectContaining({
          id: secondApplication.registrationId,
          status: 'approved',
        }),
      ])
    );

    const actualRegistrations = await prismaService.registration.findMany({
      where: {
        id: {
          in: [firstApplication.registrationId, secondApplication.registrationId],
        },
      },
    });

    expect(actualRegistrations).toHaveLength(2);
    expect(
      actualRegistrations.every(
        registration =>
          registration.status === RegistrationStatus.APPLICATION_APPROVED &&
          registration.reviewedById === adminUser.id &&
          registration.reviewedAt !== null
      )
    ).toBe(true);
  });

  async function setupCoreConfig(): Promise<void> {
    const existingConfig = await prismaService.coreConfig.findFirst();

    if (!existingConfig) {
      const createdConfig = await prismaService.coreConfig.create({
        data: buildBaseCoreConfigData(true),
      });
      testCoreConfigId = createdConfig.id;
      coreConfigCreatedByTest = true;
      return;
    }

    originalCoreConfig = {
      id: existingConfig.id,
      campName: existingConfig.campName,
      registrationYear: existingConfig.registrationYear,
      registrationOpen: existingConfig.registrationOpen,
      earlyRegistrationOpen: existingConfig.earlyRegistrationOpen,
      allowDeferredDuesPayment: existingConfig.allowDeferredDuesPayment,
      emailEnabled: existingConfig.emailEnabled,
      senderEmail: existingConfig.senderEmail,
      senderName: existingConfig.senderName,
      applicationApprovalRequired: existingConfig.applicationApprovalRequired,
    };
    testCoreConfigId = existingConfig.id;

    await updateTestCoreConfig({ applicationApprovalRequired: true });
  }

  async function restoreCoreConfig(): Promise<void> {
    if (coreConfigCreatedByTest) {
      await prismaService.coreConfig
        .delete({ where: { id: testCoreConfigId } })
        .catch(() => undefined);
      return;
    }

    if (!originalCoreConfig) {
      return;
    }

    await prismaService.coreConfig
      .update({
        where: { id: originalCoreConfig.id },
        data: {
          campName: originalCoreConfig.campName,
          registrationYear: originalCoreConfig.registrationYear,
          registrationOpen: originalCoreConfig.registrationOpen,
          earlyRegistrationOpen: originalCoreConfig.earlyRegistrationOpen,
          allowDeferredDuesPayment: originalCoreConfig.allowDeferredDuesPayment,
          emailEnabled: originalCoreConfig.emailEnabled,
          senderEmail: originalCoreConfig.senderEmail,
          senderName: originalCoreConfig.senderName,
          applicationApprovalRequired: originalCoreConfig.applicationApprovalRequired,
        },
      })
      .catch(() => undefined);
  }

  function buildBaseCoreConfigData(applicationApprovalRequired: boolean) {
    return {
      campName: `Application Approval ${TEST_RUN_ID}`,
      registrationYear: TEST_YEAR,
      registrationOpen: true,
      earlyRegistrationOpen: false,
      allowDeferredDuesPayment: false,
      emailEnabled: false,
      senderEmail: TEST_SENDER_EMAIL,
      senderName: TEST_SENDER_NAME,
      applicationApprovalRequired,
    };
  }

  async function updateTestCoreConfig(options: {
    applicationApprovalRequired: boolean;
  }): Promise<void> {
    await prismaService.coreConfig.update({
      where: { id: testCoreConfigId },
      data: buildBaseCoreConfigData(options.applicationApprovalRequired),
    });
  }

  async function createSupportData(): Promise<void> {
    const createdShift = await prismaService.shift.create({
      data: {
        name: `Shift ${TEST_RUN_ID}`,
        description: 'Application approval integration test shift',
        startTime: '09:00',
        endTime: '13:00',
        dayOfWeek: DayOfWeek.MONDAY,
      },
    });
    testShiftId = createdShift.id;

    const createdJobCategory = await prismaService.jobCategory.create({
      data: {
        name: `Category ${TEST_RUN_ID}`,
        description: 'Application approval integration test category',
      },
    });
    testJobCategoryId = createdJobCategory.id;

    const createdJob = await prismaService.job.create({
      data: {
        name: `Job ${TEST_RUN_ID}`,
        location: 'Playa',
        categoryId: testJobCategoryId,
        shiftId: testShiftId,
        maxRegistrations: 25,
      },
    });
    testJobId = createdJob.id;

    const createdCampingOption = await prismaService.campingOption.create({
      data: {
        name: `Camping ${TEST_RUN_ID}`,
        description: 'Application approval integration test camping option',
        enabled: true,
        workShiftsRequired: 1,
        participantDues: 150,
        staffDues: 75,
        maxSignups: 100,
      },
    });
    testCampingOptionId = createdCampingOption.id;
  }

  async function createAuthenticatedUser(
    input: CreateTestUserInput
  ): Promise<AuthenticatedTestUser> {
    const normalizedLabel = input.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const user = await prismaService.user.create({
      data: {
        email: `${normalizedLabel}.${randomUUID()}@example.playaplan.app`,
        password: TEST_PASSWORD,
        firstName: toDisplayName(normalizedLabel),
        lastName: 'Workflow',
        role: input.role,
        isEmailVerified: true,
        autoApproveRegistration: input.autoApproveRegistration ?? false,
        allowRegistration: input.allowRegistration ?? true,
        allowEarlyRegistration: input.allowEarlyRegistration ?? false,
        allowDeferredDuesPayment: input.allowDeferredDuesPayment ?? false,
        allowNoJob: input.allowNoJob ?? false,
      },
    });

    createdUserIds.push(user.id);
    createdUserEmails.push(user.email);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      token: jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
    };
  }

  async function createSubmittedApplication(label: string): Promise<{
    user: AuthenticatedTestUser;
    registrationId: string;
  }> {
    return createApplicationForNewUser(label, { role: UserRole.PARTICIPANT });
  }

  async function createApplicationForNewUser(
    label: string,
    input: Omit<CreateTestUserInput, 'label'>
  ): Promise<{
    user: AuthenticatedTestUser;
    registrationId: string;
  }> {
    const user = await createAuthenticatedUser({ label, ...input });
    const response = await request(app.getHttpServer())
      .post('/registrations/apply')
      .set('Authorization', `Bearer ${user.token}`)
      .send(buildApplicationPayload())
      .expect(201);

    return {
      user,
      registrationId: response.body.registration.id as string,
    };
  }

  function buildApplicationPayload(): { campingOptions: string[] } {
    return {
      campingOptions: [testCampingOptionId],
    };
  }

  function buildCompleteRegistrationPayload(): {
    jobs: string[];
    acceptedTerms: boolean;
    deferPayment: boolean;
  } {
    return {
      jobs: [testJobId],
      acceptedTerms: true,
      deferPayment: false,
    };
  }

  function toDisplayName(value: string): string {
    return value
      .split('-')
      .filter(segment => segment.length > 0)
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  async function cleanupTestData(): Promise<void> {
    if (createdUserIds.length > 0) {
      const campingOptionRegistrations = await prismaService.campingOptionRegistration.findMany({
        where: {
          userId: {
            in: createdUserIds,
          },
        },
        select: {
          id: true,
        },
      });
      const campingOptionRegistrationIds = campingOptionRegistrations.map(
        campingOptionRegistration => campingOptionRegistration.id
      );

      if (campingOptionRegistrationIds.length > 0) {
        await prismaService.campingOptionFieldValue.deleteMany({
          where: {
            registrationId: {
              in: campingOptionRegistrationIds,
            },
          },
        });
      }

      const registrations = await prismaService.registration.findMany({
        where: {
          userId: {
            in: createdUserIds,
          },
        },
        select: {
          id: true,
        },
      });
      const registrationIds = registrations.map(registration => registration.id);

      if (registrationIds.length > 0) {
        await prismaService.registrationJob.deleteMany({
          where: {
            registrationId: {
              in: registrationIds,
            },
          },
        });
      }

      await prismaService.payment.deleteMany({
        where: {
          userId: {
            in: createdUserIds,
          },
        },
      });
      await prismaService.adminAudit.deleteMany({
        where: {
          adminUserId: {
            in: createdUserIds,
          },
        },
      });
      await prismaService.emailAudit.deleteMany({
        where: {
          OR: [
            {
              userId: {
                in: createdUserIds,
              },
            },
            {
              recipientEmail: {
                in: createdUserEmails,
              },
            },
          ],
        },
      });
      await prismaService.notification.deleteMany({
        where: {
          recipient: {
            in: createdUserEmails,
          },
        },
      });
      await prismaService.campingOptionRegistration.deleteMany({
        where: {
          userId: {
            in: createdUserIds,
          },
        },
      });

      if (registrationIds.length > 0) {
        await prismaService.registration.deleteMany({
          where: {
            id: {
              in: registrationIds,
            },
          },
        });
      }

      await prismaService.user.deleteMany({
        where: {
          id: {
            in: createdUserIds,
          },
        },
      });
    }

    if (testJobId) {
      await prismaService.job.deleteMany({ where: { id: testJobId } });
    }
    if (testJobCategoryId) {
      await prismaService.jobCategory.deleteMany({ where: { id: testJobCategoryId } });
    }
    if (testShiftId) {
      await prismaService.shift.deleteMany({ where: { id: testShiftId } });
    }
    if (testCampingOptionId) {
      await prismaService.campingOption.deleteMany({ where: { id: testCampingOptionId } });
    }
  }
});
