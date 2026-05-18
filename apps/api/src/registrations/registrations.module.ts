import { Module } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { RegistrationsController } from './registrations.controller';
import { RegistrationAdminService } from './services/registration-admin.service';
import { RegistrationCleanupService } from './services/registration-cleanup.service';
import { RegistrationPolicyService } from './services/registration-policy.service';
import { AdminRegistrationsController } from './controllers/admin-registrations.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { PaymentsModule } from '../payments/payments.module';
import { CoreConfigModule } from '../core-config/core-config.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    AdminAuditModule,
    PaymentsModule,
    CoreConfigModule,
  ],
  controllers: [RegistrationsController, AdminRegistrationsController],
  providers: [
    RegistrationsService,
    RegistrationAdminService,
    RegistrationCleanupService,
    RegistrationPolicyService,
  ],
  exports: [
    RegistrationsService,
    RegistrationAdminService,
    RegistrationCleanupService,
    RegistrationPolicyService,
  ],
})
export class RegistrationsModule {}
