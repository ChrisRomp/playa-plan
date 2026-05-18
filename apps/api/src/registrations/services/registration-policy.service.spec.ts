import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RegistrationPolicyService } from './registration-policy.service';
import { CoreConfigService } from '../../core-config/services/core-config.service';

type PolicyUser = {
  id: string;
  allowRegistration: boolean;
  allowEarlyRegistration: boolean;
  allowNoJob: boolean;
  allowDeferredDuesPayment: boolean;
};

const buildUser = (overrides: Partial<PolicyUser> = {}): PolicyUser => ({
  id: 'user-1',
  allowRegistration: true,
  allowEarlyRegistration: false,
  allowNoJob: false,
  allowDeferredDuesPayment: false,
  ...overrides,
});

const buildConfig = (overrides: {
  registrationOpen?: boolean;
  earlyRegistrationOpen?: boolean;
  allowDeferredDuesPayment?: boolean;
} = {}) => ({
  registrationOpen: false,
  earlyRegistrationOpen: false,
  allowDeferredDuesPayment: false,
  ...overrides,
});

describe('RegistrationPolicyService', () => {
  let service: RegistrationPolicyService;
  let coreConfig: { findCurrent: jest.Mock };

  beforeEach(async () => {
    coreConfig = { findCurrent: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationPolicyService,
        { provide: CoreConfigService, useValue: coreConfig },
      ],
    }).compile();

    service = module.get(RegistrationPolicyService);
  });

  describe('assertCanCreateCampRegistration', () => {
    describe('per-user allowRegistration flag', () => {
      it('throws ForbiddenException when allowRegistration is false', async () => {
        coreConfig.findCurrent.mockResolvedValue(
          buildConfig({ registrationOpen: true }),
        );
        const inputUser = buildUser({ allowRegistration: false });

        await expect(
          service.assertCanCreateCampRegistration(inputUser, {
            jobs: ['job-1'],
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('uses the account-not-enabled message when allowRegistration is false', async () => {
        coreConfig.findCurrent.mockResolvedValue(
          buildConfig({ registrationOpen: true }),
        );
        const inputUser = buildUser({ allowRegistration: false });

        await expect(
          service.assertCanCreateCampRegistration(inputUser, {
            jobs: ['job-1'],
          }),
        ).rejects.toThrow(/not available for your account/i);
      });
    });

    describe('registration window', () => {
      it('allows when registrationOpen is true', async () => {
        coreConfig.findCurrent.mockResolvedValue(
          buildConfig({ registrationOpen: true }),
        );
        const inputUser = buildUser();

        await expect(
          service.assertCanCreateCampRegistration(inputUser, {
            jobs: ['job-1'],
          }),
        ).resolves.toBeUndefined();
      });

      it('rejects when both windows are closed', async () => {
        coreConfig.findCurrent.mockResolvedValue(buildConfig());
        const inputUser = buildUser();

        await expect(
          service.assertCanCreateCampRegistration(inputUser, {
            jobs: ['job-1'],
          }),
        ).rejects.toThrow(/not currently open/i);
      });

      it('rejects when only early window is open and user is not flagged', async () => {
        coreConfig.findCurrent.mockResolvedValue(
          buildConfig({ earlyRegistrationOpen: true }),
        );
        const inputUser = buildUser({ allowEarlyRegistration: false });

        await expect(
          service.assertCanCreateCampRegistration(inputUser, {
            jobs: ['job-1'],
          }),
        ).rejects.toThrow(/not currently open/i);
      });

      it('uses the same not-open message for closed and early-only-ineligible to avoid leaking state', async () => {
        coreConfig.findCurrent
          .mockResolvedValueOnce(buildConfig())
          .mockResolvedValueOnce(
            buildConfig({ earlyRegistrationOpen: true }),
          );
        const inputUser = buildUser({ allowEarlyRegistration: false });

        const closedErr = await service
          .assertCanCreateCampRegistration(inputUser, { jobs: ['job-1'] })
          .catch((e) => e);
        const earlyOnlyErr = await service
          .assertCanCreateCampRegistration(inputUser, { jobs: ['job-1'] })
          .catch((e) => e);

        expect(closedErr.message).toBe(earlyOnlyErr.message);
      });

      it('allows early-only window when user has allowEarlyRegistration', async () => {
        coreConfig.findCurrent.mockResolvedValue(
          buildConfig({ earlyRegistrationOpen: true }),
        );
        const inputUser = buildUser({ allowEarlyRegistration: true });

        await expect(
          service.assertCanCreateCampRegistration(inputUser, {
            jobs: ['job-1'],
          }),
        ).resolves.toBeUndefined();
      });
    });

    describe('must-have-jobs rule', () => {
      it('rejects when user lacks allowNoJob and jobs is empty', async () => {
        coreConfig.findCurrent.mockResolvedValue(
          buildConfig({ registrationOpen: true }),
        );
        const inputUser = buildUser({ allowNoJob: false });

        await expect(
          service.assertCanCreateCampRegistration(inputUser, { jobs: [] }),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('allows when user has allowNoJob and jobs is empty', async () => {
        coreConfig.findCurrent.mockResolvedValue(
          buildConfig({ registrationOpen: true }),
        );
        const inputUser = buildUser({ allowNoJob: true });

        await expect(
          service.assertCanCreateCampRegistration(inputUser, { jobs: [] }),
        ).resolves.toBeUndefined();
      });

      it('allows when user lacks allowNoJob but has at least one job', async () => {
        coreConfig.findCurrent.mockResolvedValue(
          buildConfig({ registrationOpen: true }),
        );
        const inputUser = buildUser({ allowNoJob: false });

        await expect(
          service.assertCanCreateCampRegistration(inputUser, {
            jobs: ['job-1'],
          }),
        ).resolves.toBeUndefined();
      });

      it('treats undefined jobs as empty for the requirement check', async () => {
        coreConfig.findCurrent.mockResolvedValue(
          buildConfig({ registrationOpen: true }),
        );
        const inputUser = buildUser({ allowNoJob: false });

        await expect(
          service.assertCanCreateCampRegistration(inputUser, {
            jobs: undefined as unknown as string[],
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      });
    });

    describe('deferred-payment gate', () => {
      it('is a no-op when deferPayment is false', async () => {
        coreConfig.findCurrent.mockResolvedValue(
          buildConfig({
            registrationOpen: true,
            allowDeferredDuesPayment: false,
          }),
        );
        const inputUser = buildUser({ allowDeferredDuesPayment: false });

        await expect(
          service.assertCanCreateCampRegistration(inputUser, {
            jobs: ['job-1'],
            deferPayment: false,
          }),
        ).resolves.toBeUndefined();
      });

      it('rejects when deferPayment is true but camp config disallows it', async () => {
        coreConfig.findCurrent.mockResolvedValue(
          buildConfig({
            registrationOpen: true,
            allowDeferredDuesPayment: false,
          }),
        );
        const inputUser = buildUser({ allowDeferredDuesPayment: true });

        await expect(
          service.assertCanCreateCampRegistration(inputUser, {
            jobs: ['job-1'],
            deferPayment: true,
          }),
        ).rejects.toThrow(/not enabled for this camp/i);
      });

      it('rejects when deferPayment is true but per-user flag is false', async () => {
        coreConfig.findCurrent.mockResolvedValue(
          buildConfig({
            registrationOpen: true,
            allowDeferredDuesPayment: true,
          }),
        );
        const inputUser = buildUser({ allowDeferredDuesPayment: false });

        await expect(
          service.assertCanCreateCampRegistration(inputUser, {
            jobs: ['job-1'],
            deferPayment: true,
          }),
        ).rejects.toThrow(/not eligible to defer/i);
      });

      it('allows when deferPayment is true and both flags are true', async () => {
        coreConfig.findCurrent.mockResolvedValue(
          buildConfig({
            registrationOpen: true,
            allowDeferredDuesPayment: true,
          }),
        );
        const inputUser = buildUser({ allowDeferredDuesPayment: true });

        await expect(
          service.assertCanCreateCampRegistration(inputUser, {
            jobs: ['job-1'],
            deferPayment: true,
          }),
        ).resolves.toBeUndefined();
      });
    });

    describe('check ordering', () => {
      it('checks allowRegistration before window state', async () => {
        coreConfig.findCurrent.mockResolvedValue(
          buildConfig({ registrationOpen: false }),
        );
        const inputUser = buildUser({ allowRegistration: false });

        await expect(
          service.assertCanCreateCampRegistration(inputUser, {
            jobs: ['job-1'],
          }),
        ).rejects.toThrow(/not available for your account/i);
      });

      it('checks window before must-have-jobs', async () => {
        coreConfig.findCurrent.mockResolvedValue(
          buildConfig({ registrationOpen: false }),
        );
        const inputUser = buildUser({ allowNoJob: false });

        await expect(
          service.assertCanCreateCampRegistration(inputUser, { jobs: [] }),
        ).rejects.toThrow(/not currently open/i);
      });

      it('checks must-have-jobs before deferred-payment gate', async () => {
        coreConfig.findCurrent.mockResolvedValue(
          buildConfig({
            registrationOpen: true,
            allowDeferredDuesPayment: false,
          }),
        );
        const inputUser = buildUser({
          allowNoJob: false,
          allowDeferredDuesPayment: true,
        });

        await expect(
          service.assertCanCreateCampRegistration(inputUser, {
            jobs: [],
            deferPayment: true,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('loads coreConfig exactly once per call', async () => {
        coreConfig.findCurrent.mockResolvedValue(
          buildConfig({
            registrationOpen: true,
            allowDeferredDuesPayment: true,
          }),
        );
        const inputUser = buildUser({
          allowDeferredDuesPayment: true,
        });

        await service.assertCanCreateCampRegistration(inputUser, {
          jobs: ['job-1'],
          deferPayment: true,
        });

        expect(coreConfig.findCurrent).toHaveBeenCalledTimes(1);
      });
    });
  });
});
