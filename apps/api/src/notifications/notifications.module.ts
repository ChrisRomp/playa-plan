import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './services/notifications.service';
import { EmailService } from './services/email.service';
import { EmailAuditService } from './services/email-audit.service';
import { NotificationsController } from './controllers/notifications.controller';
import { CoreConfigModule } from '../core-config/core-config.module';

/**
 * Module that handles all notification-related functionality
 * including email sending and notifications management
 */
@Module({
  imports: [ConfigModule, CoreConfigModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailService, EmailAuditService],
  exports: [NotificationsService, EmailService, EmailAuditService],
})
export class NotificationsModule {} 