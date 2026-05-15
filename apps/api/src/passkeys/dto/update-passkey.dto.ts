import { IsString, Matches, MaxLength } from 'class-validator';

/**
 * Payload for renaming a passkey. Nickname is plaintext only,
 * capped at 40 characters. Same constraint enforced client-side
 * in the profile UI.
 */
export class UpdatePasskeyDto {
  @IsString()
  @Matches(/\S/, { message: 'Nickname is required' })
  @MaxLength(40, { message: 'Nickname must be 40 characters or fewer' })
  nickname!: string;
}
