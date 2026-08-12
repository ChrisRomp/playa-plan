import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ReportType, User, UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('ReportsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let testUsers: User[];
  let adminToken: string;
  let staffToken: string;
  let participantToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    );
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    await prisma.reportConfiguration.deleteMany({
      where: { reportType: ReportType.TICKET_RECEIPT_SIGNATURE },
    });

    testUsers = await Promise.all([
      createUser('reports-admin@example.playaplan.app', UserRole.ADMIN),
      createUser('reports-staff@example.playaplan.app', UserRole.STAFF),
      createUser('reports-participant@example.playaplan.app', UserRole.PARTICIPANT),
    ]);
    adminToken = createToken(testUsers[0]);
    staffToken = createToken(testUsers[1]);
    participantToken = createToken(testUsers[2]);
  });

  afterAll(async () => {
    await prisma.adminAudit.deleteMany({
      where: { adminUserId: { in: testUsers.map(user => user.id) } },
    });
    await prisma.reportConfiguration.deleteMany({
      where: { reportType: ReportType.TICKET_RECEIPT_SIGNATURE },
    });
    await prisma.user.deleteMany({
      where: { id: { in: testUsers.map(user => user.id) } },
    });
    await app.close();
  });

  it('shouldRejectUnauthenticatedRequests', async () => {
    await request(app.getHttpServer()).get('/reports/ticket-receipt/configuration').expect(401);

    await request(app.getHttpServer()).post('/reports/ticket-receipt').send({}).expect(401);
  });

  it('shouldRejectParticipantRequests', async () => {
    await request(app.getHttpServer())
      .get('/reports/ticket-receipt/configuration')
      .set('Authorization', `Bearer ${participantToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/reports/ticket-receipt')
      .set('Authorization', `Bearer ${participantToken}`)
      .send(createReportRequest(1))
      .expect(403);
  });

  it.each([
    ['admin', () => adminToken],
    ['staff', () => staffToken],
  ])('shouldAllow%sToReadConfiguration', async (_role, getToken) => {
    const response = await request(app.getHttpServer())
      .get('/reports/ticket-receipt/configuration')
      .set('Authorization', `Bearer ${getToken()}`)
      .expect(200);

    expect(response.body).toEqual({
      title: 'Ticket Receipt Report',
      acknowledgementText: '',
    });
  });

  it('shouldRejectInvalidReportOptions', async () => {
    await request(app.getHttpServer())
      .post('/reports/ticket-receipt')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        ...createReportRequest(1),
        title: '   ',
        unexpected: true,
      })
      .expect(400);
  });

  it('shouldReturnNotFoundWhenNoAttendeesOrBlankRowsExist', async () => {
    await request(app.getHttpServer())
      .post('/reports/ticket-receipt')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(createReportRequest(0))
      .expect(404);
  });

  it('shouldGeneratePdfWithDownloadHeadersForStaff', async () => {
    const response = await request(app.getHttpServer())
      .post('/reports/ticket-receipt')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(createReportRequest(1))
      .expect(200)
      .expect('Content-Type', /application\/pdf/)
      .expect('Content-Disposition', /attachment;/);

    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  async function createUser(email: string, role: UserRole): Promise<User> {
    return prisma.user.upsert({
      where: { email },
      update: { role },
      create: {
        email,
        firstName: 'Report',
        lastName: role,
        role,
        isEmailVerified: true,
      },
    });
  }

  function createToken(user: User): string {
    return jwtService.sign({
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });
  }

  function createReportRequest(additionalBlankRows: number): Record<string, unknown> {
    return {
      title: 'Ticket Receipt Report',
      acknowledgementText: 'I acknowledge receipt of my ticket.',
      year: 2099,
      additionalBlankRows,
    };
  }
});
