import { Module } from '@nestjs/common';
import { UserController } from './controllers/user.controller';
import { UserService } from './services/user.service';
import { UserTransformInterceptor } from './interceptors/user-transform.interceptor';
import { NotificationsModule } from '../notifications/notifications.module';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [NotificationsModule],
  controllers: [UserController],
  providers: [
    UserService,
    {
      provide: APP_INTERCEPTOR,
      useClass: UserTransformInterceptor,
    }
  ],
  exports: [UserService], // Export the service so other modules can use it
})
export class UsersModule {}