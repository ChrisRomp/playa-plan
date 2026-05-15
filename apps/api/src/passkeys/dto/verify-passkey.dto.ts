import { IsObject, IsString, Matches, MaxLength } from 'class-validator';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';

/**
 * Browser-supplied registration response from
 * `@simplewebauthn/browser`'s `startRegistration()`. Optionally
 * includes a user-supplied nickname for the new passkey. The
 * nickname is decorated explicitly so the global validation pipe
 * (`forbidNonWhitelisted: true`) does not reject the field.
 */
export class VerifyRegistrationDto {
  @IsObject()
  response!: RegistrationResponseJSON;

  @IsString()
  @Matches(/\S/, { message: 'Nickname is required' })
  @MaxLength(40, { message: 'Nickname must be 40 characters or fewer' })
  nickname!: string;
}

/**
 * Browser-supplied authentication response from
 * `@simplewebauthn/browser`'s `startAuthentication()`.
 */
export class VerifyAuthenticationDto {
  @IsObject()
  response!: AuthenticationResponseJSON;
}
