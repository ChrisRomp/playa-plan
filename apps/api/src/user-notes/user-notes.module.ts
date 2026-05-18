import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { UserNotesController } from './controllers/user-notes.controller';
import { UserNotesService } from './services/user-notes.service';

/**
 * Module providing CRUD endpoints for internal user notes (1:many).
 * Notes are visible only to STAFF/ADMIN users and are never surfaced
 * through participant-level endpoints or views.
 */
@Module({
  imports: [PrismaModule],
  controllers: [UserNotesController],
  providers: [UserNotesService],
  exports: [UserNotesService],
})
export class UserNotesModule {}
