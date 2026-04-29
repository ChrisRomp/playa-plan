import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationType, UserRole, WebAuthnChallengeType } from '@prisma/client';
import { PasskeysService, MAX_PASSKEYS_PER_USER } from './passkeys.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const mockedGenerateRegistrationOptions = generateRegistrationOptions as jest.MockedFunction<
  typeof generateRegistrationOptions
>;
const mockedVerifyRegistrationResponse = verifyRegistrationResponse as jest.MockedFunction<
  typeof verifyRegistrationResponse
>;
const mockedGenerateAuthenticationOptions = generateAuthenticationOptions as jest.MockedFunction<
  typeof generateAuthenticationOptions
>;
const mockedVerifyAuthenticationResponse = verifyAuthenticationResponse as jest.MockedFunction<
  typeof verifyAuthenticationResponse
>;

const buildClientDataJSON = (challenge: string): string =>
  Buffer.from(JSON.stringify({ challenge, type: 'webauthn.get', origin: 'https://example.test' }))
    .toString('base64url');

describe('PasskeysService', () => {
  let service: PasskeysService;
  let prisma: {
    passkey: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    webAuthnChallenge: {
      create: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let notifications: { sendNotification: jest.Mock };

  const user = {
    id: 'user-1',
    email: 'user@example.test',
    firstName: 'Test',
    lastName: 'User',
  };

  const fullUser = {
    ...user,
    password: null,
    playaName: null,
    profilePicture: null,
    phone: null,
    city: null,
    stateProvince: null,
    country: null,
    emergencyContact: null,
    role: UserRole.PARTICIPANT,
    isEmailVerified: true,
    allowRegistration: true,
    allowEarlyRegistration: false,
    allowDeferredDuesPayment: false,
    allowNoJob: false,
    internalNotes: null,
    verificationToken: null,
    resetToken: null,
    resetTokenExpiry: null,
    loginCode: null,
    loginCodeExpiry: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const webauthnConfig = {
    rpId: 'example.test',
    rpName: 'Example',
    origin: 'https://example.test',
  };

  beforeEach(async () => {
    prisma = {
      passkey: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      webAuthnChallenge: {
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    notifications = { sendNotification: jest.fn().mockResolvedValue(true) };
    const config = {
      get: jest.fn((key: string) => (key === 'webauthn' ? webauthnConfig : undefined)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasskeysService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(PasskeysService);
    jest.clearAllMocks();
    prisma.webAuthnChallenge.deleteMany.mockResolvedValue({ count: 0 });
    notifications.sendNotification.mockResolvedValue(true);
  });

  // ---------------------------------------------------------------------------
  // Registration options
  // ---------------------------------------------------------------------------

  describe('createRegistrationOptions', () => {
    it('returns options with required residentKey and userVerification', async () => {
      prisma.passkey.count.mockResolvedValue(0);
      prisma.passkey.findMany.mockResolvedValue([]);
      mockedGenerateRegistrationOptions.mockResolvedValue({ challenge: 'chal-1' } as never);

      await service.createRegistrationOptions(user);

      expect(mockedGenerateRegistrationOptions).toHaveBeenCalledTimes(1);
      const args = mockedGenerateRegistrationOptions.mock.calls[0][0];
      expect(args.authenticatorSelection).toMatchObject({
        residentKey: 'required',
        requireResidentKey: true,
        userVerification: 'required',
      });
      expect(args.rpID).toBe('example.test');
      expect(args.rpName).toBe('Example');
      expect(prisma.webAuthnChallenge.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          challenge: 'chal-1',
          userId: user.id,
          type: WebAuthnChallengeType.REGISTRATION,
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('reuses webAuthnUserID from existing passkey', async () => {
      prisma.passkey.count.mockResolvedValue(1);
      prisma.passkey.findMany.mockResolvedValue([
        { credentialId: 'cred-old', transports: ['internal'], webAuthnUserID: 'existing-handle' },
      ]);
      mockedGenerateRegistrationOptions.mockResolvedValue({ challenge: 'chal-2' } as never);

      await service.createRegistrationOptions(user);

      const args = mockedGenerateRegistrationOptions.mock.calls[0][0];
      const decoded = new TextDecoder().decode(args.userID as Uint8Array);
      expect(decoded).toBe('existing-handle');
      expect(args.excludeCredentials).toEqual([
        { id: 'cred-old', transports: ['internal'] },
      ]);
    });

    it('uses user.id as webAuthnUserID for first passkey', async () => {
      prisma.passkey.count.mockResolvedValue(0);
      prisma.passkey.findMany.mockResolvedValue([]);
      mockedGenerateRegistrationOptions.mockResolvedValue({ challenge: 'chal-3' } as never);

      await service.createRegistrationOptions(user);

      const args = mockedGenerateRegistrationOptions.mock.calls[0][0];
      const decoded = new TextDecoder().decode(args.userID as Uint8Array);
      expect(decoded).toBe(user.id);
    });

    it('rejects when user already has the maximum number of passkeys', async () => {
      prisma.passkey.count.mockResolvedValue(MAX_PASSKEYS_PER_USER);

      await expect(service.createRegistrationOptions(user)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockedGenerateRegistrationOptions).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Verify registration
  // ---------------------------------------------------------------------------

  describe('verifyRegistration', () => {
    const challenge = 'chal-reg';
    const response = {
      id: 'cred-new',
      rawId: 'cred-new',
      type: 'public-key',
      response: {
        clientDataJSON: buildClientDataJSON(challenge),
        attestationObject: 'attestation-bytes',
      },
    } as never;

    const persistedPasskey = {
      id: 'pk-1',
      userId: user.id,
      credentialId: 'cred-new',
      nickname: 'My iPhone',
      createdAt: new Date(),
    };

    beforeEach(() => {
      prisma.passkey.count.mockResolvedValue(0);
      prisma.webAuthnChallenge.delete.mockResolvedValue({
        id: 'wc-1',
        challenge,
        userId: user.id,
        type: WebAuthnChallengeType.REGISTRATION,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.passkey.create.mockResolvedValue(persistedPasskey);
      mockedVerifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: {
            id: 'cred-new',
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 0,
            transports: ['internal'],
          },
          credentialDeviceType: 'multiDevice',
          credentialBackedUp: true,
        },
      } as never);
    });

    it('persists credential including webAuthnUserID', async () => {
      const result = await service.verifyRegistration(user, response, 'My iPhone');

      expect(prisma.passkey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: user.id,
          credentialId: 'cred-new',
          webAuthnUserID: user.id,
          counter: BigInt(0),
          nickname: 'My iPhone',
          transports: ['internal'],
          deviceType: 'multiDevice',
          backedUp: true,
        }),
      });
      expect(result).toBe(persistedPasskey);
    });

    it('atomically consumes the challenge by delete-on-read', async () => {
      await service.verifyRegistration(user, response);
      expect(prisma.webAuthnChallenge.delete).toHaveBeenCalledWith({
        where: { challenge },
      });
    });

    it('rejects when challenge is unknown / already used (P2025)', async () => {
      prisma.webAuthnChallenge.delete.mockRejectedValueOnce(new Error('Record not found'));
      await expect(service.verifyRegistration(user, response)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('dispatches PASSKEY_ADDED notification', async () => {
      await service.verifyRegistration(user, response, 'My iPhone');
      await new Promise((resolve) => setImmediate(resolve));
      expect(notifications.sendNotification).toHaveBeenCalledWith(
        user.email,
        NotificationType.PASSKEY_ADDED,
        expect.objectContaining({
          userId: user.id,
          passkeyDetails: expect.objectContaining({ nickname: 'My iPhone' }),
        }),
      );
    });

    it('rejects nicknames longer than 20 chars', async () => {
      await expect(
        service.verifyRegistration(user, response, 'a'.repeat(21)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects expired challenges', async () => {
      prisma.webAuthnChallenge.delete.mockResolvedValueOnce({
        id: 'wc-1',
        challenge,
        userId: user.id,
        type: WebAuthnChallengeType.REGISTRATION,
        expiresAt: new Date(Date.now() - 10),
      });
      await expect(service.verifyRegistration(user, response)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects challenge belonging to another user', async () => {
      prisma.webAuthnChallenge.delete.mockResolvedValueOnce({
        id: 'wc-1',
        challenge,
        userId: 'someone-else',
        type: WebAuthnChallengeType.REGISTRATION,
        expiresAt: new Date(Date.now() + 60_000),
      });
      await expect(service.verifyRegistration(user, response)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects when verification fails', async () => {
      mockedVerifyRegistrationResponse.mockResolvedValueOnce({ verified: false } as never);
      await expect(service.verifyRegistration(user, response)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('normalizes verifier exceptions to BadRequestException', async () => {
      mockedVerifyRegistrationResponse.mockRejectedValueOnce(
        new Error('Unexpected origin foo.com'),
      );
      await expect(service.verifyRegistration(user, response)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects malformed registration shape', async () => {
      const badResponse = { id: 'x', type: 'public-key', response: {} } as never;
      await expect(service.verifyRegistration(user, badResponse)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Authentication options
  // ---------------------------------------------------------------------------

  describe('createAuthenticationOptions', () => {
    it('uses usernameless flow with empty allowCredentials', async () => {
      mockedGenerateAuthenticationOptions.mockResolvedValue({ challenge: 'chal-auth' } as never);
      await service.createAuthenticationOptions();

      const args = mockedGenerateAuthenticationOptions.mock.calls[0][0];
      expect(args.allowCredentials).toEqual([]);
      expect(args.userVerification).toBe('required');
      expect(args.rpID).toBe('example.test');
      expect(prisma.webAuthnChallenge.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          challenge: 'chal-auth',
          userId: null,
          type: WebAuthnChallengeType.AUTHENTICATION,
        }),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Verify authentication
  // ---------------------------------------------------------------------------

  describe('verifyAuthentication', () => {
    const challenge = 'chal-auth';
    const encodeHandle = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
    const buildResponse = (overrides: Partial<{ userHandle: string }> = {}) =>
      ({
        id: 'cred-stored',
        rawId: 'cred-stored',
        type: 'public-key',
        response: {
          clientDataJSON: buildClientDataJSON(challenge),
          authenticatorData: 'auth-data',
          signature: 'sig',
          userHandle: encodeHandle(overrides.userHandle ?? user.id),
        },
      } as never);

    const seedChallenge = () => {
      prisma.webAuthnChallenge.delete.mockResolvedValue({
        id: 'wc-2',
        challenge,
        userId: null,
        type: WebAuthnChallengeType.AUTHENTICATION,
        expiresAt: new Date(Date.now() + 60_000),
      });
    };

    const seedPasskey = (storedCounter: number) => {
      prisma.passkey.findUnique.mockResolvedValue({
        id: 'pk-1',
        userId: user.id,
        credentialId: 'cred-stored',
        publicKey: Buffer.from([9, 9]),
        counter: BigInt(storedCounter),
        webAuthnUserID: user.id,
        transports: ['internal'],
        nickname: 'Phone',
        user: fullUser,
      });
    };

    const mockVerify = (newCounter: number) => {
      mockedVerifyAuthenticationResponse.mockResolvedValueOnce({
        verified: true,
        authenticationInfo: {
          newCounter,
          credentialBackedUp: true,
          credentialDeviceType: 'multiDevice',
        },
      } as never);
    };

    it('accepts when stored=0 and new=0 (Apple synced passkey)', async () => {
      seedChallenge();
      seedPasskey(0);
      mockVerify(0);

      const result = await service.verifyAuthentication(buildResponse());
      expect(result.user.id).toBe(user.id);
      expect(prisma.passkey.update).toHaveBeenCalledWith({
        where: { id: 'pk-1' },
        data: expect.objectContaining({ counter: BigInt(0) }),
      });
    });

    it('accepts when counter increments (5 → 6)', async () => {
      seedChallenge();
      seedPasskey(5);
      mockVerify(6);

      await service.verifyAuthentication(buildResponse());
      expect(prisma.passkey.update).toHaveBeenCalledWith({
        where: { id: 'pk-1' },
        data: expect.objectContaining({ counter: BigInt(6) }),
      });
    });

    it('rejects counter regression (6 → 5)', async () => {
      seedChallenge();
      seedPasskey(6);
      mockVerify(5);

      await expect(service.verifyAuthentication(buildResponse())).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.passkey.update).not.toHaveBeenCalled();
    });

    it('accepts 0 → nonzero', async () => {
      seedChallenge();
      seedPasskey(0);
      mockVerify(7);

      await service.verifyAuthentication(buildResponse());
      expect(prisma.passkey.update).toHaveBeenCalledWith({
        where: { id: 'pk-1' },
        data: expect.objectContaining({ counter: BigInt(7) }),
      });
    });

    it('accepts nonzero → 0 but does not downgrade stored counter', async () => {
      seedChallenge();
      seedPasskey(5);
      mockVerify(0);

      await service.verifyAuthentication(buildResponse());
      // We accept the response, but persist the higher stored counter
      // so we never lose clone-detection history.
      expect(prisma.passkey.update).toHaveBeenCalledWith({
        where: { id: 'pk-1' },
        data: expect.objectContaining({ counter: BigInt(5) }),
      });
    });

    it('normalizes verifier exceptions to UnauthorizedException', async () => {
      seedChallenge();
      seedPasskey(5);
      mockedVerifyAuthenticationResponse.mockRejectedValueOnce(
        new Error('Unexpected RP ID hash'),
      );
      await expect(service.verifyAuthentication(buildResponse())).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects malformed authentication response with Unauthorized', async () => {
      const bad = { id: 'x', response: {} } as never;
      await expect(service.verifyAuthentication(bad)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects userHandle mismatch', async () => {
      seedChallenge();
      seedPasskey(5);
      mockVerify(6);

      await expect(
        service.verifyAuthentication(buildResponse({ userHandle: 'different-handle' })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(mockedVerifyAuthenticationResponse).not.toHaveBeenCalled();
    });

    it('rejects unknown credential', async () => {
      seedChallenge();
      prisma.passkey.findUnique.mockResolvedValue(null);

      await expect(service.verifyAuthentication(buildResponse())).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('does not return password field on user', async () => {
      seedChallenge();
      seedPasskey(0);
      mockVerify(1);

      const result = await service.verifyAuthentication(buildResponse());
      expect(result.user).not.toHaveProperty('password');
    });
  });

  // ---------------------------------------------------------------------------
  // Management
  // ---------------------------------------------------------------------------

  describe('listForUser', () => {
    it('returns passkeys ordered by createdAt desc', async () => {
      prisma.passkey.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
      const out = await service.listForUser(user.id);
      expect(prisma.passkey.findMany).toHaveBeenCalledWith({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(out).toHaveLength(2);
    });
  });

  describe('deleteForUser', () => {
    it('deletes the passkey and notifies the user', async () => {
      prisma.passkey.findFirst.mockResolvedValue({
        id: 'pk-1',
        userId: user.id,
        nickname: 'Phone',
        createdAt: new Date(),
      });
      prisma.passkey.delete.mockResolvedValue({});

      await service.deleteForUser(user.id, 'pk-1', user);
      await new Promise((resolve) => setImmediate(resolve));

      expect(prisma.passkey.delete).toHaveBeenCalledWith({ where: { id: 'pk-1' } });
      expect(notifications.sendNotification).toHaveBeenCalledWith(
        user.email,
        NotificationType.PASSKEY_REMOVED,
        expect.any(Object),
      );
    });

    it('throws NotFound when passkey does not exist', async () => {
      prisma.passkey.findFirst.mockResolvedValue(null);
      await expect(service.deleteForUser(user.id, 'pk-x', user)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFound (not Forbidden) when passkey belongs to another user', async () => {
      // findFirst({ id, userId }) returns null when not owned, so we cannot
      // distinguish "missing" from "wrong owner" — and that is intentional
      // (avoids leaking existence of other users' passkey IDs).
      prisma.passkey.findFirst.mockResolvedValue(null);
      await expect(service.deleteForUser(user.id, 'pk-1', user)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.passkey.delete).not.toHaveBeenCalled();
    });
  });

  describe('updateNickname', () => {
    it('updates the nickname when caller owns the passkey', async () => {
      prisma.passkey.findFirst.mockResolvedValue({
        id: 'pk-1',
        userId: user.id,
        nickname: 'Old',
      });
      prisma.passkey.update.mockResolvedValue({ id: 'pk-1', nickname: 'New' });

      const out = await service.updateNickname(user.id, 'pk-1', 'New');
      expect(prisma.passkey.update).toHaveBeenCalledWith({
        where: { id: 'pk-1' },
        data: { nickname: 'New' },
      });
      expect(out.nickname).toBe('New');
    });

    it('rejects nicknames over 20 chars', async () => {
      await expect(
        service.updateNickname(user.id, 'pk-1', 'x'.repeat(21)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound when caller does not own the passkey', async () => {
      prisma.passkey.findFirst.mockResolvedValue(null);
      await expect(service.updateNickname(user.id, 'pk-1', 'New')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFound when passkey does not exist', async () => {
      prisma.passkey.findFirst.mockResolvedValue(null);
      await expect(service.updateNickname(user.id, 'pk-x', 'New')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
