import { Module } from '@nestjs/common';
import { CampingOptionsController } from './controllers/camping-options.controller';
import { CampingOptionFieldsController } from './controllers/camping-option-fields.controller';
import { CampingOptionsService } from './services/camping-options.service';
import { CampingOptionFieldsService } from './services/camping-option-fields.service';
import { PrismaModule } from '../common/prisma/prisma.module';

/**
 * Module for managing camping options and their custom fields
 */
@Module({
  imports: [PrismaModule],
  controllers: [CampingOptionsController, CampingOptionFieldsController],
  providers: [CampingOptionsService, CampingOptionFieldsService],
  exports: [CampingOptionsService, CampingOptionFieldsService],
})
export class CampingOptionsModule {} 