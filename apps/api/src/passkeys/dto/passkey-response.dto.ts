import { ApiProperty } from '@nestjs/swagger';
import { Passkey } from '@prisma/client';

/**
 * Public-safe view of a passkey. Excludes credentialId, publicKey,
 * webAuthnUserID, and counter so that internal credential material is
 * never exposed via API responses.
 */
export class PasskeyResponseDto {
  @ApiProperty({ description: 'Passkey database ID' })
  id!: string;

  @ApiProperty({ description: 'User-supplied label' })
  nickname!: string;

  @ApiProperty({ description: 'Authenticator transports (e.g., internal, hybrid, usb)' })
  transports!: string[];

  @ApiProperty({ description: 'Whether the credential is backed up by the platform' })
  backedUp!: boolean;

  @ApiProperty({ description: 'singleDevice | multiDevice', nullable: true })
  deviceType!: string | null;

  @ApiProperty({ description: 'Last successful sign-in time', nullable: true })
  lastUsedAt!: Date | null;

  @ApiProperty({ description: 'When the passkey was registered' })
  createdAt!: Date;

  /**
   * Maps a Passkey row to the response DTO, dropping any sensitive fields.
   */
  static fromEntity(passkey: Passkey): PasskeyResponseDto {
    return {
      id: passkey.id,
      nickname: passkey.nickname,
      transports: passkey.transports,
      backedUp: passkey.backedUp,
      deviceType: passkey.deviceType,
      lastUsedAt: passkey.lastUsedAt,
      createdAt: passkey.createdAt,
    };
  }
}
