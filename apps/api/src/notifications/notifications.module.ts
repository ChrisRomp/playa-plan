import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './services/notifications.service';
import { EmailService } from './services/email.service';
import { NotificationsController } from './controllers/notifications.controller';

/**
 * Module that handles all notification-related functionality
 * including email sending and notifications management
 */
@Module({
  imports: [ConfigModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailService],
  exports: [NotificationsService, EmailService],
})
export class NotificationsModule {} 