import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SafeUser } from '../src/auth/types/safe-user';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Unverified User Cleanup (e2e)', () => {
  const adminUser: SafeUser = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    playaName: null,
    profilePicture: null,
    role: UserRole.ADMIN,
    isEmailVerified: true,
    phone: null,
    city: null,
    stateProvince: null,
    country: null,
    emergencyContact: null,
    allowDeferredDuesPayment: false,
    allowEarlyRegistration: false,
    allowNoJob: false,
    allowRegistration: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const staffUser = {
    ...adminUser,
    id: '22222222-2222-4222-8222-222222222222',
    email: 'staff@example.com',
    role: UserRole.STAFF,
  };
  const participantUser = {
    ...adminUser,
    id: '33333333-3333-4333-8333-333333333333',
    email: 'participant@example.com',
    role: UserRole.PARTICIPANT,
  };

  let app: INestApplication;
  let jwtService: JwtService;
  let activeUser: SafeUser = adminUser;
  const transactionMock = {
    user: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    emailAudit: {
      deleteMany: jest.fn(),
    },
    adminAudit: {
      createMany: jest.fn(),
    },
  };
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      })
    );
    jwtService = moduleFixture.get(JwtService);
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    activeUser = adminUser;
    prismaMock.user.findUnique.mockImplementation(async () => activeUser);
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);
    transactionMock.user.findMany.mockResolvedValue([]);
    transactionMock.user.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.$transaction.mockImplementation(
      async (callback: (transaction: typeof transactionMock) => Promise<unknown>) =>
        callback(transactionMock)
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const getAuthToken = (user: SafeUser): string =>
    jwtService.sign({ sub: user.id, email: user.email, role: user.role });

  it('should allow admins to list cleanup candidates', async () => {
    const createdAt = new Date('2026-07-01T12:00:00.000Z');
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: participantUser.id,
        email: participantUser.email,
        firstName: participantUser.firstName,
        lastName: participantUser.lastName,
        createdAt,
      },
    ]);
    prismaMock.user.count.mockResolvedValue(1);

    const response = await request(app.getHttpServer())
      .get('/admin/users/unverified-cleanup')
      .set('Authorization', `Bearer ${getAuthToken(adminUser)}`)
      .expect(200);

    expect(response.body.users).toEqual([
      expect.objectContaining({
        id: participantUser.id,
        createdAt: createdAt.toISOString(),
      }),
    ]);
  });

  it.each([
    ['staff', staffUser],
    ['participant', participantUser],
  ])('should deny %s users access to cleanup candidates', async (_label, user) => {
    activeUser = user;

    await request(app.getHttpServer())
      .get('/admin/users/unverified-cleanup')
      .set('Authorization', `Bearer ${getAuthToken(user)}`)
      .expect(403);
  });

  it.each([
    ['staff', staffUser],
    ['participant', participantUser],
  ])('should deny %s users access to bulk cleanup', async (_label, user) => {
    activeUser = user;

    await request(app.getHttpServer())
      .post('/admin/users/unverified-cleanup/delete')
      .set('Authorization', `Bearer ${getAuthToken(user)}`)
      .send({ ids: [participantUser.id] })
      .expect(403);
  });

  it('should allow admins to submit a bounded cleanup request', async () => {
    const response = await request(app.getHttpServer())
      .post('/admin/users/unverified-cleanup/delete')
      .set('Authorization', `Bearer ${getAuthToken(adminUser)}`)
      .send({ ids: [participantUser.id] })
      .expect(200);

    expect(response.body).toEqual({
      deleted: [],
      skipped: [{ id: participantUser.id, reason: 'NOT_FOUND' }],
    });
  });

  it('should reject cleanup requests larger than the batch limit', async () => {
    const ids = Array.from(
      { length: 101 },
      (_value, index) => `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
    );

    await request(app.getHttpServer())
      .post('/admin/users/unverified-cleanup/delete')
      .set('Authorization', `Bearer ${getAuthToken(adminUser)}`)
      .send({ ids })
      .expect(400);
  });
});
