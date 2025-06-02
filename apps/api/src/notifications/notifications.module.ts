import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './services/notifications.service';
import { EmailService } from './services/email.service';
import { EmailAuditService } from './services/email-audit.service';
import { AdminNotificationsService } from './services/admin-notifications.service';
import { NotificationsController } from './controllers/notifications.controller';
import { CoreConfigModule } from '../core-config/core-config.module';

/**
 * Module that handles all notification-related functionality
 * including email sending and notifications management
 */
@Module({
  imports: [ConfigModule, forwardRef(() => CoreConfigModule)],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailService, EmailAuditService, AdminNotificationsService],
  exports: [NotificationsService, EmailService, EmailAuditService, AdminNotificationsService],
})
export class NotificationsModule {} 