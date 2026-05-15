import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PasskeysService } from './services/passkeys.service';
import { PasskeyController } from './controllers/passkey.controller';

/**
 * Provides the WebAuthn passkey enrollment, management, and assertion
 * service. Exports PasskeysService so AuthModule can use it from the
 * public passkey login endpoints on AuthController.
 */
@Module({
  imports: [PrismaModule, ConfigModule, NotificationsModule],
  controllers: [PasskeyController],
  providers: [PasskeysService],
  exports: [PasskeysService],
})
export class PasskeysModule {}
