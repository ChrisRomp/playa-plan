import { Module } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { RegistrationsController } from './registrations.controller';
import { RegistrationAdminService } from './services/registration-admin.service';
import { RegistrationCleanupService } from './services/registration-cleanup.service';
import { AdminRegistrationsController } from './controllers/admin-registrations.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PrismaModule, NotificationsModule, AdminAuditModule, PaymentsModule],
  controllers: [RegistrationsController, AdminRegistrationsController],
  providers: [RegistrationsService, RegistrationAdminService, RegistrationCleanupService],
  exports: [RegistrationsService, RegistrationAdminService, RegistrationCleanupService],
})
export class RegistrationsModule {}
