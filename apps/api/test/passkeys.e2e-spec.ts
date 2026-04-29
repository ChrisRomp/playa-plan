import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { UserRole, WebAuthnChallengeType } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as nodemailer from 'nodemailer';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import * as webauthn from '@simplewebauthn/server';

// Mocking @simplewebauthn/server lets us drive the registration and
// authentication paths deterministically without needing a real
// authenticator. We override only the verify functions; the option
// generators run as-is so we exercise our config wiring.
jest.mock('@simplewebauthn/server', () => {
  const actual = jest.requireActual('@simplewebauthn/server');
  return {
    ...actual,
    verifyRegistrationResponse: jest.fn(),
    verifyAuthenticationResponse: jest.fn(),
  };
});

// Stub nodemailer so passkey-add notifications don't try to send real mail.
jest.mock('nodemailer');

describe('Passkeys (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let userId: string;
  let userToken: string;
  const userEmail = 'passkey-user@example.playaplan.app';

  const verifyRegistration = webauthn.verifyRegistrationResponse as jest.Mock;
  const verifyAuthentication = webauthn.verifyAuthenticationResponse as jest.Mock;

  beforeAll(async () => {
    const mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'm-1' }),
      verify: jest.fn().mockResolvedValue(true),
    } as unknown as nodemailer.Transporter;
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
    (nodemailer.createTestAccount as jest.Mock).mockResolvedValue({
      smtp: { host: 'smtp.test', port: 587, secure: false },
      user: 'u',
      pass: 'p',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
    jwtService = app.get(JwtService);

    await prisma.passkey.deleteMany();
    await prisma.webAuthnChallenge.deleteMany();
    await prisma.user.deleteMany({ where: { email: userEmail } });

    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: userEmail,
        firstName: 'Passkey',
        lastName: 'User',
        role: UserRole.PARTICIPANT,
        isEmailVerified: true,
      },
    });
    userId = user.id;
    userToken = jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  });

  afterAll(async () => {
    await prisma.passkey.deleteMany();
    await prisma.webAuthnChallenge.deleteMany();
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  beforeEach(() => {
    verifyRegistration.mockReset();
    verifyAuthentication.mockReset();
  });

  /** Helper: construct a clientDataJSON whose challenge matches one we issued. */
  const clientDataJSON = (challenge: string): string =>
    Buffer.from(
      JSON.stringify({ type: 'webauthn.create', challenge, origin: 'http://localhost:5173' }),
    ).toString('base64url');

  describe('registration round-trip', () => {
    it('issues options, accepts a verified attestation, and stores a redacted passkey', async () => {
      const optionsRes = await request(app.getHttpServer())
        .post('/passkeys/registration/options')
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(optionsRes.body).toHaveProperty('challenge');
      expect(optionsRes.body).toHaveProperty('rp');
      const challenge = optionsRes.body.challenge as string;

      const challengeRow = await prisma.webAuthnChallenge.findUnique({
        where: { challenge },
      });
      expect(challengeRow).toBeTruthy();
      expect(challengeRow?.type).toBe(WebAuthnChallengeType.REGISTRATION);
      expect(challengeRow?.userId).toBe(userId);

      verifyRegistration.mockResolvedValueOnce({
        verified: true,
        registrationInfo: {
          credential: {
            id: 'cred-e2e-1',
            publicKey: new Uint8Array([1, 2, 3, 4]),
            counter: 0,
            transports: ['internal'],
          },
          credentialDeviceType: 'multiDevice',
          credentialBackedUp: true,
        },
      });

      const verifyRes = await request(app.getHttpServer())
        .post('/passkeys/registration/verify')
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          response: {
            id: 'cred-e2e-1',
            rawId: 'cred-e2e-1',
            type: 'public-key',
            response: {
              clientDataJSON: clientDataJSON(challenge),
              attestationObject: 'attestation-bytes',
            },
            clientExtensionResults: {},
          },
          nickname: 'My Test Key',
        })
        .expect(201);

      expect(verifyRes.body).toMatchObject({
        nickname: 'My Test Key',
        backedUp: true,
        deviceType: 'multiDevice',
      });
      // Sensitive fields must NOT be exposed:
      expect(verifyRes.body).not.toHaveProperty('credentialId');
      expect(verifyRes.body).not.toHaveProperty('publicKey');
      expect(verifyRes.body).not.toHaveProperty('webAuthnUserID');
      expect(verifyRes.body).not.toHaveProperty('counter');

      const stored = await prisma.passkey.findFirst({
        where: { userId, credentialId: 'cred-e2e-1' },
      });
      expect(stored).toBeTruthy();
      expect(stored?.webAuthnUserID).toBe(userId);

      // Challenge must have been atomically consumed.
      const reread = await prisma.webAuthnChallenge.findUnique({
        where: { challenge },
      });
      expect(reread).toBeNull();
    });

    it('rejects nicknames longer than 20 chars at the DTO layer', async () => {
      const optionsRes = await request(app.getHttpServer())
        .post('/passkeys/registration/options')
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);
      const challenge = optionsRes.body.challenge;

      const res = await request(app.getHttpServer())
        .post('/passkeys/registration/verify')
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          response: {
            id: 'x',
            rawId: 'x',
            type: 'public-key',
            response: {
              clientDataJSON: clientDataJSON(challenge),
              attestationObject: 'a',
            },
            clientExtensionResults: {},
          },
          nickname: 'x'.repeat(21),
        });
      expect(res.status).toBe(400);
    });
  });

  describe('list and management', () => {
    it('lists passkeys without sensitive fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/passkeys')
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const p of res.body) {
        expect(p).not.toHaveProperty('publicKey');
        expect(p).not.toHaveProperty('credentialId');
        expect(p).not.toHaveProperty('webAuthnUserID');
        expect(p).not.toHaveProperty('counter');
      }
    });

    it('updates a nickname for owned passkeys and 404s for non-owned', async () => {
      const owned = await prisma.passkey.findFirst({
        where: { userId, credentialId: 'cred-e2e-1' },
      });
      expect(owned).toBeTruthy();

      await request(app.getHttpServer())
        .patch(`/passkeys/${owned!.id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ nickname: 'Renamed' })
        .expect(200);

      const renamed = await prisma.passkey.findUnique({ where: { id: owned!.id } });
      expect(renamed?.nickname).toBe('Renamed');

      const fakeId = randomUUID();
      await request(app.getHttpServer())
        .patch(`/passkeys/${fakeId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ nickname: 'Renamed' })
        .expect(404);
    });
  });

  describe('passkey login (discoverable / usernameless)', () => {
    it('issues authentication options with empty allowCredentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/passkey/options')
        .expect(200);
      expect(res.body).toHaveProperty('challenge');
      expect(Array.isArray(res.body.allowCredentials)).toBe(true);
      expect(res.body.allowCredentials.length).toBe(0);
    });

    it('verifies an assertion and issues a JWT including amr=["passkey"]', async () => {
      const optionsRes = await request(app.getHttpServer())
        .post('/auth/passkey/options')
        .expect(200);
      const challenge = optionsRes.body.challenge as string;

      verifyAuthentication.mockResolvedValueOnce({
        verified: true,
        authenticationInfo: {
          newCounter: 1,
          credentialBackedUp: true,
          credentialDeviceType: 'multiDevice',
        },
      });

      const userHandleB64u = Buffer.from(userId, 'utf8').toString('base64url');
      const verifyRes = await request(app.getHttpServer())
        .post('/auth/passkey/verify')
        .send({
          response: {
            id: 'cred-e2e-1',
            rawId: 'cred-e2e-1',
            type: 'public-key',
            response: {
              clientDataJSON: Buffer.from(
                JSON.stringify({
                  type: 'webauthn.get',
                  challenge,
                  origin: 'http://localhost:5173',
                }),
              ).toString('base64url'),
              authenticatorData: 'auth-data',
              signature: 'signature',
              userHandle: userHandleB64u,
            },
            clientExtensionResults: {},
          },
        })
        .expect(200);

      expect(verifyRes.body).toHaveProperty('accessToken');
      expect(verifyRes.body).toHaveProperty('userId', userId);

      const decoded = jwtService.decode(verifyRes.body.accessToken) as Record<string, unknown>;
      expect(decoded.amr).toEqual(['passkey']);
      expect(decoded.sub).toBe(userId);
    });

    it('returns generic 401 for malformed assertions (no protocol detail leak)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/passkey/verify')
        .send({ response: { id: 'x', response: {} } })
        .expect(401);
      // Generic message — no library/origin details
      const body = res.body as { message?: string };
      expect(body.message).toBeDefined();
      expect(body.message).not.toMatch(/origin|RP ID|signature|attestation/i);
    });
  });
});
