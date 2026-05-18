import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { User } from '@prisma/client';
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
 * The public API is a single `assertCanCreateCampRegistration(user, dto)`
 * method that loads the current `coreConfig` once and runs every applicable
 * check in a defined order. This makes it impossible for a caller to forget
 * one of the gates.
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
      | 'allowRegistration'
      | 'allowEarlyRegistration'
      | 'allowNoJob'
      | 'allowDeferredDuesPayment'
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
