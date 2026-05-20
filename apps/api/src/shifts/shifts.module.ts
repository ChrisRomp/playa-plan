import { Module } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RegistrationsModule } from '../registrations/registrations.module';
import { CoreConfigModule } from '../core-config/core-config.module';

/**
 * Module for managing shifts within camp sessions
 */
@Module({
  imports: [PrismaModule, RegistrationsModule, CoreConfigModule],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {} 