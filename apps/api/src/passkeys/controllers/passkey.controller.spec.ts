import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PasskeyController } from './passkey.controller';
import { PasskeysService } from '../services/passkeys.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { Passkey, User, UserRole } from '@prisma/client';

describe('PasskeyController', () => {
  let controller: PasskeyController;
  let passkeysService: {
    createRegistrationOptions: jest.Mock;
    verifyRegistration: jest.Mock;
    listForUser: jest.Mock;
    updateNickname: jest.Mock;
    deleteForUser: jest.Mock;
  };

  const mockUser: Omit<User, 'password'> = {
    id: 'user-1',
    email: 'a@b.test',
    firstName: 'Test',
    lastName: 'User',
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

  const mockPasskey = {
    id: 'pk-1',
    userId: 'user-1',
    credentialId: 'cred-secret',
    publicKey: Buffer.from([1, 2, 3]),
    counter: BigInt(0),
    transports: ['internal'],
    deviceType: 'multiDevice',
    backedUp: true,
    nickname: 'iPhone',
    webAuthnUserID: 'user-1',
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Passkey;

  const mockReq = { user: mockUser } as unknown as Parameters<
    PasskeyController['list']
  >[0];

  beforeEach(async () => {
    passkeysService = {
      createRegistrationOptions: jest.fn(),
      verifyRegistration: jest.fn(),
      listForUser: jest.fn(),
      updateNickname: jest.fn(),
      deleteForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PasskeyController],
      providers: [{ provide: PasskeysService, useValue: passkeysService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PasskeyController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  describe('@Public regression', () => {
    it('does NOT expose any of its endpoints as public', () => {
      const reflector = new Reflector();
      const handlerNames = ['registrationOptions', 'verifyRegistration', 'list', 'update', 'remove'] as const;
      for (const name of handlerNames) {
        const handler = (controller as unknown as Record<string, () => unknown>)[name];
        const isPublic = reflector.get<boolean | undefined>(IS_PUBLIC_KEY, handler);
        expect(isPublic).toBeFalsy();
      }
    });
  });

  describe('registrationOptions', () => {
    it('delegates to PasskeysService with the authenticated user', async () => {
      passkeysService.createRegistrationOptions.mockResolvedValue({ challenge: 'c' });
      const out = await controller.registrationOptions(mockReq);
      expect(passkeysService.createRegistrationOptions).toHaveBeenCalledWith(mockUser);
      expect(out).toEqual({ challenge: 'c' });
    });
  });

  describe('verifyRegistration', () => {
    it('returns a redacted response (no credentialId / publicKey)', async () => {
      passkeysService.verifyRegistration.mockResolvedValue(mockPasskey);
      const out = await controller.verifyRegistration(mockReq, {
        response: {} as never,
        nickname: 'iPhone',
      });
      expect(passkeysService.verifyRegistration).toHaveBeenCalledWith(mockUser, {}, 'iPhone');
      expect(out).not.toHaveProperty('credentialId');
      expect(out).not.toHaveProperty('publicKey');
      expect(out).not.toHaveProperty('webAuthnUserID');
      expect(out).not.toHaveProperty('counter');
      expect(out.nickname).toBe('iPhone');
    });
  });

  describe('list', () => {
    it('returns all of the user\'s passkeys, redacted', async () => {
      passkeysService.listForUser.mockResolvedValue([mockPasskey]);
      const out = await controller.list(mockReq);
      expect(passkeysService.listForUser).toHaveBeenCalledWith(mockUser.id);
      expect(out).toHaveLength(1);
      expect(out[0]).not.toHaveProperty('credentialId');
      expect(out[0]).not.toHaveProperty('publicKey');
    });
  });

  describe('update', () => {
    it('passes ownership context to the service', async () => {
      passkeysService.updateNickname.mockResolvedValue({ ...mockPasskey, nickname: 'New' });
      const out = await controller.update(mockReq, 'pk-1', { nickname: 'New' });
      expect(passkeysService.updateNickname).toHaveBeenCalledWith(mockUser.id, 'pk-1', 'New');
      expect(out.nickname).toBe('New');
      expect(out).not.toHaveProperty('credentialId');
    });
  });

  describe('email verification gate', () => {
    const unverifiedReq = {
      user: { ...mockUser, isEmailVerified: false },
    } as unknown as Parameters<PasskeyController['list']>[0];

    it('rejects registrationOptions when email is not verified', async () => {
      await expect(controller.registrationOptions(unverifiedReq)).rejects.toMatchObject({
        status: 403,
      });
      expect(passkeysService.createRegistrationOptions).not.toHaveBeenCalled();
    });

    it('rejects verifyRegistration when email is not verified', async () => {
      await expect(
        controller.verifyRegistration(unverifiedReq, {
          response: {} as never,
          nickname: 'iPhone',
        }),
      ).rejects.toMatchObject({ status: 403 });
      expect(passkeysService.verifyRegistration).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('passes ownership context and the actor to the service', async () => {
      passkeysService.deleteForUser.mockResolvedValue(undefined);
      await controller.remove(mockReq, 'pk-1');
      expect(passkeysService.deleteForUser).toHaveBeenCalledWith(mockUser.id, 'pk-1', mockUser);
    });
  });
});
