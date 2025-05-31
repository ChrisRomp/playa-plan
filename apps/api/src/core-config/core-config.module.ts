import { Module, forwardRef } from '@nestjs/common';
import { CoreConfigController } from './controllers/core-config.controller';
import { PublicConfigController } from './controllers/public-config.controller';
import { CoreConfigService } from './services/core-config.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Module for managing core site configuration
 */
@Module({
  imports: [PrismaModule, forwardRef(() => NotificationsModule)],
  controllers: [CoreConfigController, PublicConfigController],
  providers: [CoreConfigService],
  exports: [CoreConfigService],
})
export class CoreConfigModule {} 