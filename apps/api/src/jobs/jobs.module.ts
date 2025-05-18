import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CategoriesModule } from './categories/categories.module';
import { RegistrationsModule } from '../registrations/registrations.module';

@Module({
  imports: [PrismaModule, CategoriesModule, RegistrationsModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {} 