import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CoreConfigModule } from '../core-config/core-config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { PaymentsService, StripeService, PaypalService } from './services';
import { PaymentsController } from './controllers';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    CoreConfigModule,
    NotificationsModule,
    AdminAuditModule,
  ],
  controllers: [
    PaymentsController,
  ],
  providers: [
    PaymentsService,
    StripeService,
    PaypalService,
  ],
  exports: [
    PaymentsService,
    StripeService,
    PaypalService,
  ],
})
export class PaymentsModule {} 