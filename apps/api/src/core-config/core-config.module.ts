import { Module } from '@nestjs/common';
import { CoreConfigController } from './controllers/core-config.controller';
import { PublicConfigController } from './controllers/public-config.controller';
import { CoreConfigService } from './services/core-config.service';
import { PrismaModule } from '../common/prisma/prisma.module';

/**
 * Module for managing core site configuration
 */
@Module({
  imports: [PrismaModule],
  controllers: [CoreConfigController, PublicConfigController],
  providers: [CoreConfigService],
  exports: [CoreConfigService],
})
export class CoreConfigModule {} 