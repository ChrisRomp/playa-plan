import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { CreateCampRegistrationDto } from '../dto/create-camp-registration.dto';

/**
 * Centralized policy enforcement for participant camp registrations.
 *
 * Used by the participant endpoint (`POST /registrations/camp`) only. The
 * admin/staff endpoint `POST /registrations` (gated by `@Roles(ADMIN, STAFF)`)
 * intentionally bypasses these checks so admins can create or modify
 * registrations as an override path.
 *
 * The public API exposes two assertion methods:
 * - `assertCanCreateCampRegistration(user, dto)` — full registration (no approval mode)
 * - `assertCanSubmitApplication(user)` — application-only submission (approval mode)
 *
 * Plus a helper:
 * - `shouldAutoApprove(user)` — whether the user bypasses the approval queue
 */
@Injectable()
export class RegistrationPolicyService {
  private readonly logger = new Logger(RegistrationPolicyService.name);

  constructor(private readonly coreConfigService: CoreConfigService) {}

  /**
   * Run every camp-registration policy check against the calling user and
   * the submitted DTO. Throws a NestJS HttpException on the first failure;
   * returns silently on success.
   *
   * Order of checks (each takes precedence over the next):
   *   1. `assertRegistrationOpen(user, config)` — eligibility + window.
   *   2. `assertJobsRequirementMet(user, dto.jobs)` — must-have-jobs.
   *   3. `assertDeferAllowed(user, config, dto.deferPayment)` — only when
   *      the participant is opting to defer; verifies camp + user flags.
   */
  async assertCanCreateCampRegistration(
    user: Pick<
      User,
      | 'id'
      | 'role'
      | 'allowRegistration'
      | 'allowEarlyRegistration'
      | 'allowNoJob'
      | 'allowDeferredDuesPayment'
      | 'autoApproveRegistration'
    >,
    dto: Pick<CreateCampRegistrationDto, 'jobs' | 'deferPayment'>,
  ): Promise<void> {
    const config = await this.coreConfigService.findCurrent();

    this.assertRegistrationOpen(user, {
      registrationOpen: config.registrationOpen,
      earlyRegistrationOpen: config.earlyRegistrationOpen,
    });
    this.assertJobsRequirementMet(user, dto.jobs ?? []);
    this.assertDeferAllowed(
      user,
      { allowDeferredDuesPayment: config.allowDeferredDuesPayment },
      dto.deferPayment ?? false,
    );
  }

  /**
   * Assert that the user can submit an application (approval mode).
   * Only validates registration window + user eligibility.
   * Does NOT check jobs/terms/payment since those are deferred until after approval.
   */
  async assertCanSubmitApplication(
    user: Pick<User, 'id' | 'allowRegistration' | 'allowEarlyRegistration'>,
  ): Promise<void> {
    const config = await this.coreConfigService.findCurrent();

    this.assertRegistrationOpen(user, {
      registrationOpen: config.registrationOpen,
      earlyRegistrationOpen: config.earlyRegistrationOpen,
    });
  }

  /**
   * Determine whether the user should be auto-approved when submitting
   * an application. Staff/Admin roles are always auto-approved, as are
   * users with the `autoApproveRegistration` flag.
   */
  shouldAutoApprove(
    user: Pick<User, 'role' | 'autoApproveRegistration'>,
  ): boolean {
    if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF) {
      return true;
    }
    return user.autoApproveRegistration;
  }

  /**
   * Check whether application approval is currently required.
   * Returns the current config setting.
   */
  async isApprovalRequired(): Promise<boolean> {
    const config = await this.coreConfigService.findCurrent();
    return config.applicationApprovalRequired;
  }

  /**
   * Window + per-user eligibility check.
   *
   * Rules (first match wins):
   *   1. If `!user.allowRegistration` → 403 "account not enabled".
   *   2. If `registrationOpen` is true → allow.
   *   3. If `earlyRegistrationOpen` is true AND
   *      `user.allowEarlyRegistration` is true → allow.
   *   4. Otherwise → 403 "registration not currently open".
   *
   * Note: the same message is used for "fully closed" and "early-only and
   * not eligible" so the early-window state is not leaked to ineligible
   * participants. The client `registrationUtils.ts` already does the same.
   */
  private assertRegistrationOpen(
    user: Pick<User, 'allowRegistration' | 'allowEarlyRegistration'>,
    config: { registrationOpen: boolean; earlyRegistrationOpen: boolean },
  ): void {
    if (!user.allowRegistration) {
      throw new ForbiddenException(
        'Registration is not available for your account. Please contact an administrator.',
      );
    }
    if (config.registrationOpen) return;
    if (config.earlyRegistrationOpen && user.allowEarlyRegistration) return;
    throw new ForbiddenException('Registration is not currently open.');
  }

  /**
   * Must-have-jobs check. Throws BadRequestException if the user is not
   * flagged `allowNoJob` and the DTO carries an empty `jobs` array.
   */
  private assertJobsRequirementMet(
    user: Pick<User, 'allowNoJob'>,
    jobIds: string[],
  ): void {
    if (user.allowNoJob) return;
    if (jobIds.length > 0) return;
    throw new BadRequestException(
      'You must select at least one work shift to register.',
    );
  }

  /**
   * Deferred-payment eligibility check. No-op when the participant is not
   * opting to defer. Otherwise both the camp-wide config flag and the
   * per-user flag must be true.
   */
  private assertDeferAllowed(
    user: Pick<User, 'allowDeferredDuesPayment'>,
    config: { allowDeferredDuesPayment: boolean },
    deferPayment: boolean,
  ): void {
    if (!deferPayment) return;
    if (!config.allowDeferredDuesPayment) {
      throw new ForbiddenException(
        'Deferred payment is not enabled for this camp.',
      );
    }
    if (!user.allowDeferredDuesPayment) {
      throw new ForbiddenException(
        'Your account is not eligible to defer payment.',
      );
    }
  }
}
