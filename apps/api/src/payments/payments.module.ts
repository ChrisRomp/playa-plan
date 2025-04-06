import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../common/prisma/prisma.module';
import { PaymentsService, StripeService, PaypalService } from './services';
import { PaymentsController } from './controllers';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
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