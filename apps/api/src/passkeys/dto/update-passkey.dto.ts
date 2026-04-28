import { IsString, MaxLength } from 'class-validator';

/**
 * Payload for renaming a passkey. Nickname is plaintext only,
 * capped at 20 characters. Same constraint enforced client-side
 * in the profile UI.
 */
export class UpdatePasskeyDto {
  @IsString()
  @MaxLength(20, { message: 'Nickname must be 20 characters or fewer' })
  nickname!: string;
}
