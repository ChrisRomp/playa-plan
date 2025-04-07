import { Module } from '@nestjs/common';
import { CampController } from './controllers/camp.controller';
import { CampsService } from './services/camps.service';

/**
 * Module for managing camp sessions
 * Provides functionality for creating, updating, and retrieving camp information
 */
@Module({
  controllers: [CampController],
  providers: [CampsService],
  exports: [CampsService], // Export CampsService for use in other modules (like Shifts module)
})
export class CampsModule {}