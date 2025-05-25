import { Module } from '@nestjs/common';
import { UserController } from './controllers/user.controller';
import { UserNotesController } from './controllers/user-notes.controller';
import { UserService } from './services/user.service';
import { UserNotesService } from './services/user-notes.service';
import { UserTransformInterceptor } from './interceptors/user-transform.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UserController, UserNotesController],
  providers: [
    UserService,
    UserNotesService,
    {
      provide: APP_INTERCEPTOR,
      useClass: UserTransformInterceptor,
    }
  ],
  exports: [UserService, UserNotesService], // Export services so other modules can use them
})
export class UsersModule {}