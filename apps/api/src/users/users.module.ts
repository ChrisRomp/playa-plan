import { Module } from '@nestjs/common';
import { UserController } from './controllers/user.controller';
import { UserService } from './services/user.service';

@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService], // Export the service so other modules can use it
})
export class UsersModule {}