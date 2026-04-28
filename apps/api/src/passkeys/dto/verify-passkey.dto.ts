import { IsObject } from 'class-validator';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';

/**
 * Browser-supplied registration response from
 * `@simplewebauthn/browser`'s `startRegistration()`. Optionally
 * includes a user-supplied nickname for the new passkey.
 */
export class VerifyRegistrationDto {
  @IsObject()
  response!: RegistrationResponseJSON;

  nickname?: string;
}

/**
 * Browser-supplied authentication response from
 * `@simplewebauthn/browser`'s `startAuthentication()`.
 */
export class VerifyAuthenticationDto {
  @IsObject()
  response!: AuthenticationResponseJSON;
}
